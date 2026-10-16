"""Geometric constraint resolution from DrawingIR → SolvedModel."""

from __future__ import annotations

from app.schemas import (
    Assumption,
    Dimension,
    DimensionKind,
    DrawingIR,
    FeatureClass,
    ReconstructionStatus,
    SolvedModel,
    Uncertainty,
)


def solve_constraints(ir: DrawingIR) -> SolvedModel:
    """Map dimensions + features into CAD parameters with cross-checks."""
    solved = SolvedModel(part_class=ir.part_class or "revolved")
    solved.assumptions = list(ir.assumptions)
    solved.uncertainties = list(ir.uncertainties)

    if ir.part_class == "unsupported":
        solved.status = ReconstructionStatus.UNSUPPORTED
        return solved

    dims = list(ir.dimensions)
    scale = ir.scale_px_per_mm

    def dim_by_hint(*hints: str) -> Dimension | None:
        for h in hints:
            cands = [d for d in dims if d.attachment_hint == h]
            if not cands:
                continue
            # Height/thickness: reject absurd values from standards text (e.g. ISO 2768)
            if h in ("total_height", "flange_thickness", "plate_thickness"):
                sane = [d for d in cands if 0.5 <= d.value <= 2000]
                if sane:
                    cands = sane
            # Prefer labeled table rows; then confidence; for height prefer mid-range
            return max(
                cands,
                key=lambda d: (
                    1 if d.text and any(
                        k in d.text.lower()
                        for k in ("height", "flange thick", "plate thick", "length", "width")
                    )
                    else 0,
                    d.confidence,
                    # Prefer plausible part heights over huge standard numbers
                    -abs(d.value - 100) if h == "total_height" else d.value,
                ),
            )
        return None

    def dims_of(kind: DimensionKind) -> list[Dimension]:
        return sorted(
            [d for d in dims if d.kind == kind],
            key=lambda d: d.value,
            reverse=True,
        )

    # Flanged sleeve curated path
    if (ir.part_class or "") == "flanged_sleeve":
        return _solve_flanged_sleeve(solved, dims)

    # --- Diameters ---
    od = dim_by_hint("outer_diameter")
    bore = dim_by_hint("bore_diameter")
    barrel = dim_by_hint("barrel_diameter")
    pilot = dim_by_hint("pilot_diameter")
    bolt_d = dim_by_hint("bolt_hole_diameter")
    pcd = dim_by_hint("bolt_circle")
    key_w = dim_by_hint("keyway_width")
    key_d = dim_by_hint("keyway_depth")

    diams = dims_of(DimensionKind.DIAMETER)
    if od is None and diams:
        od = diams[0]
        od.attachment_hint = od.attachment_hint or "outer_diameter"
    if barrel is None and len(diams) >= 2 and od:
        mid = [
            d
            for d in diams
            if d is not od and d.attachment_hint != "bore_diameter" and 0.35 * od.value <= d.value < od.value
        ]
        if mid:
            barrel = max(mid, key=lambda d: d.value)
    if bore is None and len(diams) >= 2:
        # Bore is clearly smaller than barrel/OD (typically ≤ 45% of OD)
        od_v = od.value if od else diams[0].value
        bore_cands = [
            d
            for d in diams
            if d is not od
            and d is not barrel
            and 0.12 * od_v <= d.value <= 0.45 * od_v
        ]
        if bore_cands:
            bore = min(bore_cands, key=lambda d: d.value)
            bore.attachment_hint = bore.attachment_hint or "bore_diameter"

    # Feature px → mm via scale
    if scale:
        for f in ir.features:
            if f.class_ == FeatureClass.OUTER_CYLINDER and od is None:
                od_v = f.params.get("diameter_px", 0) / scale
                if od_v > 0:
                    solved.assumptions.append(
                        Assumption(
                            code="od_from_px",
                            message="Outer diameter derived from circle + scale",
                            value=od_v,
                        )
                    )
                    solved.outer_diameter_mm = od_v
            if f.class_ == FeatureClass.BORE and bore is None:
                bv = f.params.get("diameter_px", 0) / scale
                # Ignore bolt-sized "bores" from circle detect (need ~20%+ of OD)
                od_ref = (od.value if od else solved.outer_diameter_mm) or 0
                if bv > 0 and (od_ref <= 0 or 0.18 * od_ref <= bv <= 0.7 * od_ref):
                    solved.bore_diameter_mm = bv
            if f.class_ == FeatureClass.BOLT_CIRCLE:
                if pcd is None and f.params.get("pcd_px"):
                    solved.bolt_pcd_mm = f.params["pcd_px"] / scale
                if solved.bolt_count is None:
                    solved.bolt_count = int(f.params.get("count") or 0) or None
                if bolt_d is None and f.params.get("hole_diameter_px"):
                    solved.bolt_hole_diameter_mm = f.params["hole_diameter_px"] / scale
            # Skip KEYWAY from pixel features — SVG keyway rects mis-scale and deform the bore.
            # Keyway only from labeled dimension text (attachment_hint).
            if f.class_ == FeatureClass.FLANGE:
                if f.params.get("thickness_px") and solved.flange_thickness_mm is None:
                    ft = f.params["thickness_px"] / scale
                    # Flange plate is a fraction of total height — reject stack-height mistakes
                    h_ref = next(
                        (d.value for d in dims if d.attachment_hint == "total_height"),
                        None,
                    )
                    if h_ref is None or ft <= h_ref * 0.4:
                        solved.flange_thickness_mm = ft

    if od:
        solved.outer_diameter_mm = od.value
        solved.dimensions_used.append(od)
    if bore:
        # Radius dims sometimes OCR'd as diameter of bore hole from r=35 → Ø70
        # Catalog SVG uses r=35 for bore (= Ø70 visual) but spec says bore 50.
        # Prefer explicit bore hint; also accept radius*2.
        solved.bore_diameter_mm = bore.value
        solved.dimensions_used.append(bore)
    else:
        # Radius near center
        radii = [d for d in dims if d.kind == DimensionKind.RADIUS]
        if radii and solved.outer_diameter_mm:
            r = min(radii, key=lambda d: d.value)
            solved.bore_diameter_mm = r.value * 2
            solved.assumptions.append(
                Assumption(
                    code="bore_from_radius",
                    message="Bore diameter taken as 2× radius annotation",
                    value=solved.bore_diameter_mm,
                )
            )

    if barrel:
        solved.barrel_diameter_mm = barrel.value
        solved.dimensions_used.append(barrel)
    if pcd:
        solved.bolt_pcd_mm = pcd.value
        solved.dimensions_used.append(pcd)
    if bolt_d:
        solved.bolt_hole_diameter_mm = bolt_d.value
        solved.dimensions_used.append(bolt_d)
    if pilot:
        solved.pilot_diameter_mm = pilot.value
        solved.dimensions_used.append(pilot)
    if key_w:
        solved.keyway_width_mm = key_w.value
        solved.dimensions_used.append(key_w)
    if key_d:
        solved.keyway_depth_mm = key_d.value
        solved.dimensions_used.append(key_d)
    if ir.title_block.get("bolt_count"):
        try:
            solved.bolt_count = int(ir.title_block["bolt_count"])
        except ValueError:
            pass

    # Heights / thicknesses
    height = dim_by_hint("total_height")
    flange_t = dim_by_hint("flange_thickness")
    linears = [d for d in dims if d.kind == DimensionKind.LINEAR]
    diam_vals = {round(d.value, 3) for d in dims if d.kind == DimensionKind.DIAMETER}
    if height is not None and round(height.value, 3) in diam_vals:
        # Prefer a linear that is not also a diameter callout (e.g. Ø140 vs height 75).
        # Keep labeled total_height; never demote height to flange thickness.
        alts = [
            d
            for d in linears
            if round(d.value, 3) not in diam_vals
            and d.attachment_hint == "total_height"
        ]
        if not alts:
            alts = [
                d
                for d in linears
                if round(d.value, 3) not in diam_vals
                and d.attachment_hint != "flange_thickness"
            ]
        if alts:
            height = max(alts, key=lambda d: d.value)
    if height is None and linears:
        alts = [d for d in linears if round(d.value, 3) not in diam_vals]
        height = max(alts or linears, key=lambda d: d.value)
    if flange_t is None and linears and height:
        thin = [d for d in linears if d.value < height.value * 0.5]
        if thin:
            flange_t = min(thin, key=lambda d: abs(d.value - 18))

    if height:
        solved.total_height_mm = height.value
        solved.dimensions_used.append(height)
    if flange_t:
        solved.flange_thickness_mm = flange_t.value
        solved.dimensions_used.append(flange_t)

    # Cross-validate OD vs top circle scale
    if scale and od and any(f.class_ == FeatureClass.OUTER_CYLINDER for f in ir.features):
        outer = next(f for f in ir.features if f.class_ == FeatureClass.OUTER_CYLINDER)
        implied = outer.params.get("diameter_px", 0) / scale
        if implied and abs(implied - od.value) / od.value > 0.08:
            solved.uncertainties.append(
                Uncertainty(
                    code="od_scale_conflict",
                    message=f"Outer Ø {od.value} conflicts with scaled circle {implied:.1f}",
                    severity="warning",
                )
            )

    # Defaults only when partial reconstruction is still useful — always flagged
    if solved.part_class == "gear":
        return _solve_gear(solved, dims, ir)

    if solved.part_class == "prismatic":
        return _solve_prismatic(solved, dims, ir)

    return _finalize_revolved(solved)


def _solve_flanged_sleeve(solved: SolvedModel, dims: list[Dimension]) -> SolvedModel:
    """ISO-style flanged sleeve / bushing with optional tapered bore."""
    solved.part_class = "flanged_sleeve"

    def by_hint(h: str) -> Dimension | None:
        c = [d for d in dims if d.attachment_hint == h]
        return max(c, key=lambda d: (d.confidence, d.value)) if c else None

    od = by_hint("outer_diameter")
    body = by_hint("barrel_diameter")
    bore_l = by_hint("bore_large")
    bore_s = by_hint("bore_small")
    bore = by_hint("bore_diameter")
    height = by_hint("total_height")
    flange_t = by_hint("flange_thickness")
    bore_depth = by_hint("bore_depth")

    if od:
        solved.outer_diameter_mm = od.value
        solved.dimensions_used.append(od)
    if body:
        solved.barrel_diameter_mm = body.value
        solved.dimensions_used.append(body)
    elif od:
        solved.barrel_diameter_mm = od.value * 0.85
        solved.assumptions.append(
            Assumption(
                code="body_od_default",
                message="Body OD assumed 85% of flange OD",
                value=solved.barrel_diameter_mm,
            )
        )
    if height:
        solved.total_height_mm = height.value
        solved.dimensions_used.append(height)
    if flange_t:
        solved.flange_thickness_mm = flange_t.value
        solved.dimensions_used.append(flange_t)
    else:
        solved.flange_thickness_mm = 3.0
        solved.assumptions.append(
            Assumption(code="flange_t_default", message="Flange thickness assumed 3 mm", value=3)
        )

    if bore_l:
        solved.bore_large_mm = bore_l.value
        solved.dimensions_used.append(bore_l)
    if bore_s:
        solved.bore_small_mm = bore_s.value
        solved.dimensions_used.append(bore_s)
    if bore and not bore_l:
        solved.bore_diameter_mm = bore.value
        solved.bore_large_mm = bore.value
        solved.bore_small_mm = bore.value
        solved.dimensions_used.append(bore)
    elif bore_l and bore_s:
        solved.bore_diameter_mm = (bore_l.value + bore_s.value) / 2.0
    elif bore_l:
        solved.bore_diameter_mm = bore_l.value
        solved.bore_small_mm = bore_l.value

    if bore_depth:
        solved.bore_depth_mm = bore_depth.value
    elif solved.total_height_mm:
        solved.bore_depth_mm = max(solved.total_height_mm - (solved.flange_thickness_mm or 0), 1.0)

    missing = []
    if solved.outer_diameter_mm is None:
        missing.append("outer_diameter")
    if solved.total_height_mm is None:
        missing.append("total_height")
    if missing:
        solved.status = ReconstructionStatus.INCOMPLETE
        solved.uncertainties.append(
            Uncertainty(
                code="missing_critical_dims",
                message=f"Missing critical dimensions: {', '.join(missing)}",
                severity="error",
            )
        )
        return solved

    if solved.bore_diameter_mm is None and solved.bore_large_mm is None:
        solved.uncertainties.append(
            Uncertainty(
                code="missing_bore",
                message="Bore not found; solid built without bore cut",
                severity="warning",
            )
        )

    solved.status = (
        ReconstructionStatus.PARTIAL if solved.assumptions else ReconstructionStatus.COMPLETE
    )
    return solved


def _solve_gear(solved: SolvedModel, dims: list[Dimension], ir: DrawingIR) -> SolvedModel:
    diams = [d for d in dims if d.kind == DimensionKind.DIAMETER]
    if diams:
        solved.pitch_diameter_mm = max(d.value for d in diams)
        solved.outer_diameter_mm = solved.outer_diameter_mm or solved.pitch_diameter_mm
    # Tooth count from text
    import re

    for d in dims:
        m = re.search(r"(\d+)\s*T\b", d.text, re.I)
        if m:
            solved.gear_teeth = int(m.group(1))
    if solved.gear_teeth is None:
        for v in ir.title_block.values():
            m = re.search(r"(\d+)\s*T\b", v, re.I)
            if m:
                solved.gear_teeth = int(m.group(1))
    if solved.total_height_mm is None:
        solved.total_height_mm = 30.0
        solved.assumptions.append(
            Assumption(code="gear_height_default", message="Gear face width assumed 30 mm", value=30)
        )
    if solved.bore_diameter_mm is None and solved.outer_diameter_mm:
        solved.bore_diameter_mm = solved.outer_diameter_mm * 0.3
        solved.assumptions.append(
            Assumption(code="gear_bore_default", message="Gear bore assumed 30% of OD", value=solved.bore_diameter_mm)
        )
    if solved.gear_teeth is None:
        solved.uncertainties.append(
            Uncertainty(
                code="tooth_profile_unknown",
                message="Tooth count missing; exporting hub disk without accurate involute teeth",
                severity="warning",
            )
        )
        solved.status = ReconstructionStatus.PARTIAL
    else:
        solved.status = ReconstructionStatus.PARTIAL  # simplified teeth
        solved.uncertainties.append(
            Uncertainty(
                code="tooth_profile_simplified",
                message="Gear teeth approximated as triangular stubs, not true involute",
                severity="info",
            )
        )
    return solved


def _solve_prismatic(solved: SolvedModel, dims: list[Dimension], ir: DrawingIR) -> SolvedModel:
    linears = sorted([d for d in dims if d.kind == DimensionKind.LINEAR], key=lambda d: -d.value)
    plate_t = next((d for d in dims if d.attachment_hint == "plate_thickness"), None)
    # Deduplicate linear values (view callout + table often repeat)
    if len(linears) >= 2:
        lw: list[Dimension] = []
        seen: set[float] = set()
        for d in linears:
            if d is plate_t:
                continue
            key = round(d.value, 3)
            if key in seen:
                continue
            seen.add(key)
            lw.append(d)
        if len(lw) >= 2:
            solved.plate_length_mm = lw[0].value
            solved.plate_width_mm = lw[1].value
        elif len(linears) >= 2:
            solved.plate_length_mm = linears[0].value
            solved.plate_width_mm = linears[1].value
    elif len(linears) == 1:
        solved.plate_length_mm = linears[0].value
        solved.plate_width_mm = linears[0].value
        solved.assumptions.append(
            Assumption(code="square_plate", message="Single linear dim → square plate", value=linears[0].value)
        )
    diams = [d for d in dims if d.kind == DimensionKind.DIAMETER]
    solved.hole_diameters_mm = [d.value for d in diams]
    bore = next((d for d in dims if d.attachment_hint == "bore_diameter"), None)
    if bore:
        solved.bore_diameter_mm = bore.value
    if plate_t:
        solved.plate_thickness_mm = plate_t.value
        solved.total_height_mm = plate_t.value
    elif solved.total_height_mm is None:
        thin = [d for d in linears if d.value < 40]
        solved.plate_thickness_mm = thin[0].value if thin else 10.0
        if not thin:
            solved.assumptions.append(
                Assumption(code="plate_thickness_default", message="Plate thickness assumed 10 mm", value=10)
            )
    else:
        solved.plate_thickness_mm = solved.total_height_mm

    missing = []
    if solved.plate_length_mm is None:
        missing.append("length")
    if solved.plate_width_mm is None:
        missing.append("width")
    if missing:
        solved.status = ReconstructionStatus.INCOMPLETE
        solved.uncertainties.append(
            Uncertainty(
                code="missing_critical_dims",
                message=f"Missing critical dimensions: {', '.join(missing)}",
                severity="error",
            )
        )
    else:
        solved.status = ReconstructionStatus.PARTIAL if solved.assumptions else ReconstructionStatus.COMPLETE
    return solved


def _finalize_revolved(solved: SolvedModel) -> SolvedModel:
    missing = []
    if solved.outer_diameter_mm is None:
        missing.append("outer_diameter")
    if solved.total_height_mm is None:
        missing.append("total_height")
    if solved.bore_diameter_mm is None:
        solved.uncertainties.append(
            Uncertainty(
                code="missing_bore",
                message="Bore diameter not found; solid will be built without bore cut",
                severity="warning",
            )
        )

    if "outer_diameter" in missing or "total_height" in missing:
        solved.status = ReconstructionStatus.INCOMPLETE
        solved.uncertainties.append(
            Uncertainty(
                code="missing_critical_dims",
                message=f"Missing critical dimensions: {', '.join(missing)}",
                severity="error",
            )
        )
        return solved

    # Sensible optional defaults (flagged)
    # Sanitize absurd flange thickness from bad px→mm scale
    if (
        solved.flange_thickness_mm is not None
        and solved.total_height_mm
        and solved.flange_thickness_mm > solved.total_height_mm * 0.4
    ):
        solved.flange_thickness_mm = None
    if solved.flange_thickness_mm is None:
        solved.flange_thickness_mm = min(18.0, solved.total_height_mm * 0.25)
        solved.assumptions.append(
            Assumption(
                code="flange_thickness_default",
                message="Flange thickness assumed",
                value=solved.flange_thickness_mm,
            )
        )
    if solved.barrel_diameter_mm is None:
        solved.barrel_diameter_mm = solved.outer_diameter_mm * 0.6
        solved.assumptions.append(
            Assumption(
                code="barrel_diameter_default",
                message="Barrel diameter assumed as 60% of OD",
                value=solved.barrel_diameter_mm,
            )
        )
    # Sanitize bolt-hole mistaken for bore
    if (
        solved.bore_diameter_mm
        and solved.outer_diameter_mm
        and solved.bore_diameter_mm < solved.outer_diameter_mm * 0.15
    ):
        solved.bore_diameter_mm = None
    if solved.bore_diameter_mm is None and solved.outer_diameter_mm:
        # Catalog bearing housings: bore ≈ 35% OD when unlabeled
        solved.bore_diameter_mm = round(solved.outer_diameter_mm * 0.36, 2)
        solved.assumptions.append(
            Assumption(
                code="bore_default_ratio",
                message="Bore assumed as 36% of outer diameter",
                value=solved.bore_diameter_mm,
            )
        )
    if solved.pilot_diameter_mm is None and solved.bore_diameter_mm and solved.barrel_diameter_mm:
        solved.pilot_diameter_mm = min(
            solved.barrel_diameter_mm * 0.75,
            max(solved.bore_diameter_mm * 1.4, solved.bore_diameter_mm + 10),
        )
    if solved.bolt_count is None and solved.bolt_pcd_mm:
        solved.bolt_count = 4
        solved.assumptions.append(
            Assumption(code="bolt_count_default", message="Bolt count assumed 4", value=4)
        )
    if solved.bolt_hole_diameter_mm is None and solved.bolt_pcd_mm:
        solved.bolt_hole_diameter_mm = 10.0
        solved.assumptions.append(
            Assumption(code="bolt_hole_default", message="Bolt hole Ø assumed 10 mm (M10)", value=10)
        )

    # Geometric sanity
    if (
        solved.bore_diameter_mm
        and solved.outer_diameter_mm
        and solved.bore_diameter_mm >= solved.outer_diameter_mm
    ):
        solved.uncertainties.append(
            Uncertainty(
                code="bore_ge_od",
                message="Bore diameter >= outer diameter — clamping bore",
                severity="error",
            )
        )
        solved.bore_diameter_mm = solved.outer_diameter_mm * 0.35

    if solved.assumptions:
        solved.status = ReconstructionStatus.PARTIAL
    else:
        solved.status = ReconstructionStatus.COMPLETE
    return solved
