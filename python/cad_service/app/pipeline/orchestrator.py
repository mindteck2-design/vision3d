"""End-to-end reconstruction orchestration."""

from __future__ import annotations

import base64
import time
from typing import Optional

from app.pipeline.build_cad import build_solid, export_step_base64
from app.pipeline.ocr_dims import extract_dimensions_ocr, merge_dimensions
from app.pipeline.preprocess import decode_image_input, preprocess
from app.pipeline.sidecar import critical_dim_count, try_load_sidecar
from app.pipeline.solve import solve_constraints
from app.pipeline.svg_parse import extract_svg_from_data_url, parse_svg_to_ir
from app.pipeline.validate import validate_model
from app.pipeline.views import detect_views_and_features
from app.schemas import (
    DrawingIR,
    ReconstructResponse,
    ReconstructionStatus,
    SolvedModel,
)


def reconstruct(
    image_base64: Optional[str] = None,
    svg_text: Optional[str] = None,
    views: Optional[dict[str, str]] = None,
    filename: Optional[str] = None,
    prefer_svg: bool = True,
) -> ReconstructResponse:
    t0 = time.perf_counter()
    steps: list[str] = []
    ir = DrawingIR()

    # Collect SVG candidates from views / inputs
    svg_candidate = svg_text
    primary_data = None
    if views:
        primary_data = (
            views.get("blueprint_sheet")
            or views.get("front_view")
            or next(iter(views.values()), None)
        )
        if prefer_svg and not svg_candidate:
            for v in views.values():
                extracted = extract_svg_from_data_url(v) if v.startswith("data:") else None
                if extracted:
                    svg_candidate = extracted
                    break

    if image_base64 and prefer_svg and not svg_candidate:
        if image_base64.startswith("data:image/svg"):
            svg_candidate = extract_svg_from_data_url(image_base64)

    # PDF data-URL / raw bytes → dimension IR via text extract
    pdf_ir = None
    pdf_sources = [image_base64, primary_data]
    for src in pdf_sources:
        if not src:
            continue
        if isinstance(src, str) and (
            src.startswith("data:application/pdf") or src.startswith("data:application/x-pdf")
        ):
            try:
                from app.pipeline.pdf_parse import pdf_bytes_to_ir

                payload = src.split(",", 1)[1]
                raw_pdf = base64.b64decode(payload)
                pdf_ir = pdf_bytes_to_ir(raw_pdf, filename=filename)
                steps.append(f"PDF: extracted {len(pdf_ir.dimensions)} dims from text")
                break
            except Exception as e:
                steps.append(f"PDF: parse failed ({e})")

    # Stage 1–2: SVG fast-path
    if svg_candidate and prefer_svg:
        steps.append("SVG: parsing vector geometry and dimension text")
        ir = parse_svg_to_ir(svg_candidate)
        steps.append(
            f"SVG: extracted {len(ir.dimensions)} dims, {len(ir.features)} features, "
            f"{len(ir.views)} views"
        )
    elif pdf_ir is not None:
        ir = pdf_ir
        steps.append(
            f"PDF: using text IR ({len(ir.dimensions)} dims, class={ir.part_class})"
        )

    # Decode raster for CV / OCR
    bgr = None
    raw_bytes: bytes | None = None
    try:
        if primary_data:
            bgr, _ = decode_image_input(data_url=primary_data)
            if primary_data.startswith("data:") and "," in primary_data:
                payload = primary_data.split(",", 1)[1]
                try:
                    raw_bytes = base64.b64decode(payload)
                except Exception:
                    raw_bytes = None
        elif image_base64:
            bgr, _ = decode_image_input(image_base64=image_base64, svg_text=svg_text)
            payload = image_base64
            if "," in payload and payload.strip().startswith("data:"):
                payload = payload.split(",", 1)[1]
            try:
                raw_bytes = base64.b64decode(payload)
            except Exception:
                raw_bytes = None
        elif svg_candidate:
            bgr, _ = decode_image_input(svg_text=svg_candidate)
        steps.append("Preprocess: decoded input image")
    except Exception as e:
        steps.append(f"Preprocess: decode failed ({e})")

    if bgr is not None:
        layers = preprocess(bgr)
        steps.append("Preprocess: denoise/binarize/edges")

        # OCR if few dims
        if len(ir.dimensions) < 2:
            steps.append("OCR: extracting dimension annotations")
            ocr_ir = extract_dimensions_ocr(layers["bgr"])
            ir = merge_dimensions(ir, ocr_ir)
            steps.append(f"OCR: total dims now {len(ir.dimensions)}")
        else:
            steps.append("OCR: skipped (SVG dims sufficient)")

        # Multi-view fusion: process additional named views
        if views:
            for key, data in views.items():
                if key == "blueprint_sheet":
                    continue
                try:
                    from app.pipeline.preprocess import decode_image_input as dec
                    from app.schemas import BBox, View, ViewType

                    vbgr, vsvg = dec(data_url=data) if data.startswith("data:") else dec(image_base64=data)
                    if vsvg and prefer_svg:
                        vir = parse_svg_to_ir(vsvg)
                        ir = merge_dimensions(ir, vir)
                        for f in vir.features:
                            ir.features.append(f)
                    vlayers = preprocess(vbgr)
                    vtype = {
                        "front_view": ViewType.FRONT,
                        "top_view": ViewType.TOP,
                        "side_view": ViewType.SIDE,
                    }.get(key, ViewType.UNKNOWN)
                    ir.views.append(
                        View(
                            id=f"named_{key}",
                            type=vtype,
                            bbox=BBox(x=0, y=0, w=float(vbgr.shape[1]), h=float(vbgr.shape[0])),
                            label=key,
                        )
                    )
                    ir = detect_views_and_features(vlayers, ir)
                    steps.append(f"Views: fused {key}")
                except Exception as e:
                    steps.append(f"Views: failed {key} ({e})")

        # When SVG already supplied a rich labeled dim table, skip CV view fusion
        # so circle heuristics cannot overwrite Ø85 with a "6x" meta token, etc.
        svg_dims = sum(1 for d in ir.dimensions if d.source.value == "svg")
        # Enough labeled SVG dims → do not let OpenCV circles overwrite bore/flange
        if prefer_svg and (critical_dim_count(ir) >= 3 or svg_dims >= 4):
            steps.append(
                f"Views: skipped CV classify (SVG dims={svg_dims}, critical={critical_dim_count(ir)})"
            )
        else:
            steps.append("Views: detecting circles/regions on primary sheet")
            ir = detect_views_and_features(layers, ir)
            steps.append(
                f"Views: part_class={ir.part_class}, scale_px_per_mm={ir.scale_px_per_mm}"
            )
    else:
        steps.append("Preprocess: no raster; continuing with SVG IR only")
        if not ir.part_class:
            if any(d.kind.value == "diameter" for d in ir.dimensions):
                ir.part_class = "revolved"
            else:
                ir.part_class = "prismatic"

    # Curated sidecar AFTER view classify so it can override part_class/dims
    side = try_load_sidecar(filename=filename, image_bytes=raw_bytes)
    if side is not None and (
        critical_dim_count(ir) < 2 or side.part_class in ("flanged_sleeve",)
    ):
        if side.part_class == "flanged_sleeve":
            ir.dimensions = list(side.dimensions)
            ir.part_class = side.part_class
            ir.assumptions = list(ir.assumptions) + list(side.assumptions)
        else:
            ir = merge_dimensions(ir, side)
            if side.part_class:
                ir.part_class = side.part_class
        steps.append(
            f"Sidecar: applied curated IR ({len(ir.dimensions)} dims, class={ir.part_class})"
        )
    elif side is None and critical_dim_count(ir) < 2:
        steps.append("Sidecar: no match for this upload")

    # Stage 4: solve
    steps.append("Solve: resolving geometric constraints")
    solved: SolvedModel = solve_constraints(ir)
    steps.append(f"Solve: status={solved.status.value}")

    # Stage 5–6: CAD + validate
    stl_b64 = None
    step_b64 = None
    validation = None
    solid = None
    stl_path = None

    if solved.status not in (ReconstructionStatus.INCOMPLETE, ReconstructionStatus.UNSUPPORTED):
        solid, stl_path, cad_steps = build_solid(solved)
        steps.extend(cad_steps)
        validation = validate_model(stl_path, solved)
        steps.append(f"Validate: ok={validation.ok} watertight={validation.watertight}")
        if stl_path and stl_path.exists():
            stl_b64 = base64.b64encode(stl_path.read_bytes()).decode("ascii")
        if solid is not None:
            step_bytes = export_step_base64(solid)
            if step_bytes:
                step_b64 = base64.b64encode(step_bytes).decode("ascii")
    else:
        steps.append("CAD: not built due to incomplete/unsupported status")

    specs = _specs_from_solved(solved)
    elapsed = (time.perf_counter() - t0) * 1000.0

    # Overall status: downgrade if validation fails
    status = solved.status
    if status == ReconstructionStatus.COMPLETE and validation and not validation.ok:
        status = ReconstructionStatus.PARTIAL
        solved.status = status

    return ReconstructResponse(
        status=status,
        drawing_ir=ir,
        solved=solved,
        validation=validation,
        stl_base64=stl_b64,
        step_base64=step_b64,
        specifications=specs,
        processing_ms=round(elapsed, 2),
        pipeline_steps=steps,
    )


def _specs_from_solved(solved: SolvedModel) -> dict:
    return {
        "outerDiameterMm": solved.outer_diameter_mm,
        "boreDiameterMm": solved.bore_diameter_mm,
        "totalHeightMm": solved.total_height_mm,
        "flangeThicknessMm": solved.flange_thickness_mm,
        "barrelDiameterMm": solved.barrel_diameter_mm,
        "boltPattern": (
            f"{solved.bolt_count} x Ø{solved.bolt_hole_diameter_mm} on {solved.bolt_pcd_mm}mm PCD"
            if solved.bolt_count and solved.bolt_pcd_mm
            else None
        ),
        "partClass": solved.part_class,
        "status": solved.status.value,
        "assumptions": [a.model_dump() for a in solved.assumptions],
        "uncertainties": [u.model_dump() for u in solved.uncertainties],
    }
