"""SVG fast-path: extract dimensions and geometric primitives from vector drawings."""

from __future__ import annotations

import math
import re
from typing import Optional
from xml.etree import ElementTree as ET

from app.schemas import (
    BBox,
    Dimension,
    DimensionKind,
    DimensionSource,
    DrawingIR,
    Feature,
    FeatureClass,
    Uncertainty,
    View,
    ViewType,
)

DIM_RE = re.compile(
    r"(?P<prefix>[Ø⌀ø∅RrDd])?\s*(?P<value>\d+(?:\.\d+)?)\s*(?P<unit>mm|cm|in|°)?"
    r"|(?P<pcd>PCD)\s*[Ø⌀ø∅]?\s*(?P<pcd_val>\d+(?:\.\d+)?)",
    re.IGNORECASE,
)


def _hint_from_label(low: str, kind: DimensionKind, val: float) -> Optional[str]:
    """Map table/label wording to attachment hints (most reliable for SVG samples)."""
    if "pcd" in low or "bolt pattern" in low:
        return "bolt_circle"
    if "bolt" in low and kind == DimensionKind.DIAMETER:
        return "bolt_hole_diameter"
    if "pilot" in low and kind == DimensionKind.DIAMETER:
        return "pilot_diameter"
    if "keyway width" in low or ("keyway" in low and "width" in low):
        return "keyway_width"
    if "keyway depth" in low or ("keyway" in low and "depth" in low):
        return "keyway_depth"
    if any(k in low for k in ("outer", "flange od", "flange  ø", "flange ø")):
        return "outer_diameter"
    if "barrel" in low or "body" in low or "hub" in low:
        return "barrel_diameter"
    if "bore large" in low or "bore  ø19" in low:
        return "bore_large"
    if "bore small" in low or "bore  ø12" in low:
        return "bore_small"
    if "bore" in low or "counterbore" in low:
        return "bore_diameter"
    if "plate thick" in low:
        return "plate_thickness"
    if "height" in low or "overall" in low:
        return "total_height"
    # Bare "length"/"width" left unhinted so prismatic solver can pick L×W
    if "flange thick" in low or ("thickness" in low and "plate" not in low):
        return "flange_thickness"
    return None


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def _parse_transform_translate(el) -> tuple[float, float]:
    t = el.get("transform") or ""
    m = re.search(r"translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)", t)
    if m:
        return float(m.group(1)), float(m.group(2))
    return 0.0, 0.0


def parse_svg_to_ir(svg_text: str) -> DrawingIR:
    """Parse catalog-style SVG engineering drawings into DrawingIR."""
    ir = DrawingIR(units="mm")
    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError as e:
        ir.uncertainties.append(
            Uncertainty(code="svg_parse_error", message=str(e), severity="error")
        )
        return ir

    # Units from title block text
    texts: list[tuple[str, float, float]] = []
    circles: list[dict] = []
    rects: list[dict] = []

    def walk(el, ox=0.0, oy=0.0):
        dx, dy = _parse_transform_translate(el)
        cx, cy = ox + dx, oy + dy
        tag = _local(el.tag)

        if tag == "text":
            content = "".join(el.itertext()).strip()
            if content:
                x = float(el.get("x", 0)) + cx
                y = float(el.get("y", 0)) + cy
                texts.append((content, x, y))
        elif tag == "circle":
            circles.append(
                {
                    "cx": float(el.get("cx", 0)) + cx,
                    "cy": float(el.get("cy", 0)) + cy,
                    "r": float(el.get("r", 0)),
                    "fill": (el.get("fill") or "").lower(),
                    "stroke": el.get("stroke"),
                }
            )
        elif tag == "rect":
            rects.append(
                {
                    "x": float(el.get("x", 0)) + cx,
                    "y": float(el.get("y", 0)) + cy,
                    "w": float(el.get("width", 0)),
                    "h": float(el.get("height", 0)),
                    "fill": (el.get("fill") or "").lower(),
                }
            )

        for child in el:
            walk(child, cx, cy)

    walk(root)

    for content, x, y in texts:
        low = content.lower()
        if "units" in low and "mm" in low:
            ir.units = "mm"
            ir.title_block["units"] = "mm"
        if content.startswith("DWG:") or "PART:" in content:
            ir.title_block.setdefault("raw", content)

        # Part-class cue from title (easy for SVG samples)
        if "flanged sleeve" in low or "sleeve-" in low:
            ir.part_class = "flanged_sleeve"
        elif "baseplate" in low or "fixture baseplate" in low or "mounting plate" in low:
            ir.part_class = "prismatic"
        elif "cnc fixture" in low and "housing" not in low and "hub" not in low:
            ir.part_class = "prismatic"
        elif "spindle housing" in low or "coupling hub" in low or "flanged housing" in low:
            ir.part_class = "revolved"
        elif "hydraulic" in low or "end cap" in low or "cylinder cap" in low:
            ir.part_class = "revolved"
        elif "bearing housing" in low or "bushing" in low or "stepped" in low:
            ir.part_class = "revolved"

        # Skip title-block / meta lines (part numbers like BH-140-50 pollute dims)
        if any(
            content.upper().startswith(p) or f"{p}:" in content.upper()
            for p in (
                "DWG",
                "PART",
                "SCALE",
                "TOL",
                "REV",
                "MATERIAL",
                "FEATURES",
                "NOTES",
                "FINISH",
                "HEAT",
                "DATE",
                "SHEET",
                "CLIENT",
                "LEGAL",
                "TITLE",
                "OWNER",
                "DESCRIPTION",
                "GENERAL",
            )
        ):
            continue
        if low.startswith("dimensions:") or low.startswith("readable dims"):
            continue
        if low.startswith("tabulated dimensions"):
            continue
        if low.startswith("features:") or low.startswith("notes"):
            continue
        # Numbered drawing notes: "1. INTERPRET..."
        if re.match(r"^\d+\.\s", content):
            continue
        if low in (
            "end view",
            "front view",
            "top plan",
            "side view",
            "top view",
            "side elevation",
            "section a-a",
            "view b",
            "detail c",
        ):
            continue
        if "client demo" in low or "illustration only" in low or "visual only" in low:
            continue
        if "upload in vision" in low or "vision3d" in low or "reconstruct" in low:
            continue
        if "demo sheet" in low or "for 3d" in low:
            continue
        if "schematic" in low or "isometric" in low:
            continue
        if "projection" in low or "tolerance" in low or "surface texture" in low:
            continue
        if "drawing number" in low or "legal owner" in low:
            continue

        if "PCD" in content.upper():
            m = re.search(r"(\d+(?:\.\d+)?)", content)
            if m:
                ir.dimensions.append(
                    Dimension(
                        value=float(m.group(1)),
                        kind=DimensionKind.PCD,
                        text=content,
                        confidence=0.95,
                        source=DimensionSource.SVG,
                        position=(x, y),
                        attachment_hint="bolt_circle",
                    )
                )
            continue

        m = DIM_RE.search(content.replace(",", ""))
        if not m:
            continue
        if m.group("pcd_val"):
            ir.dimensions.append(
                Dimension(
                    value=float(m.group("pcd_val")),
                    kind=DimensionKind.PCD,
                    text=content,
                    confidence=0.95,
                    source=DimensionSource.SVG,
                    position=(x, y),
                    attachment_hint="bolt_circle",
                )
            )
            continue

        val = float(m.group("value"))
        prefix = (m.group("prefix") or "").upper()
        unit = (m.group("unit") or "mm").lower()
        if unit == "°":
            kind = DimensionKind.ANGLE
        elif (
            prefix in ("Ø", "⌀", "∅", "ø", "D")
            or "ø" in content.lower()
            or "⌀" in content
            or "diameter" in low
        ):
            kind = DimensionKind.DIAMETER
        elif prefix in ("R",):
            kind = DimensionKind.RADIUS
        else:
            kind = DimensionKind.LINEAR

        # Label-based hints first (table text is easiest to read)
        hint = _hint_from_label(low, kind, val)
        if hint is None:
            if kind == DimensionKind.DIAMETER:
                if val >= 100:
                    hint = "outer_diameter"
                elif val >= 55:
                    hint = "barrel_diameter"
                elif val >= 35:
                    hint = "bore_diameter"
                elif val >= 18:
                    hint = "outer_diameter" if ir.part_class == "flanged_sleeve" else "bore_diameter"
                else:
                    hint = "bolt_hole_diameter"
            elif kind == DimensionKind.LINEAR:
                if val >= 40:
                    hint = "total_height"
                elif val <= 8:
                    hint = "flange_thickness"
                elif 15 <= val <= 35:
                    hint = "total_height"

        # Sleeve taper cues
        if ir.part_class == "flanged_sleeve" and kind == DimensionKind.DIAMETER:
            if 16 <= val <= 20:
                hint = "bore_large"
            elif 10 <= val <= 14:
                hint = "bore_small"

        ir.dimensions.append(
            Dimension(
                value=val,
                kind=kind,
                unit="mm" if unit != "°" else "deg",
                text=content,
                confidence=0.98,
                source=DimensionSource.SVG,
                position=(x, y),
                attachment_hint=hint,
            )
        )

        # Bolt count from "× 6" / "x 6" / "6x" near bolt hole lines
        if hint == "bolt_hole_diameter":
            cm = re.search(r"[×xX]\s*(\d{1,2})\b|\b(\d{1,2})\s*[×xX]\b", content)
            if cm:
                n = int(cm.group(1) or cm.group(2))
                if 3 <= n <= 24:
                    ir.title_block["bolt_count"] = str(n)

    # Cluster circles into top-plan view features
    if circles:
        # Largest circle cluster by proximity of centers
        centers = [(c["cx"], c["cy"]) for c in circles]
        # Use median center as top view origin
        mx = sorted(c[0] for c in centers)[len(centers) // 2]
        my = sorted(c[1] for c in centers)[len(centers) // 2]
        top_circles = [c for c in circles if math.hypot(c["cx"] - mx, c["cy"] - my) < 250]

        view_top = View(
            id="svg_top",
            type=ViewType.TOP,
            bbox=BBox(x=mx - 150, y=my - 150, w=300, h=300),
            label="TOP PLAN (SVG)",
        )

        radii = sorted({round(c["r"], 2) for c in top_circles}, reverse=True)
        dark_fills = {"#0b1329", "#1e293b", "#0f172a", "#000000", "black", "#111827"}

        if radii:
            # Outer
            ir.features.append(
                Feature(
                    **{
                        "class": FeatureClass.OUTER_CYLINDER,
                        "params": {"diameter_px": radii[0] * 2, "radius_px": radii[0]},
                        "view_ids": ["svg_top"],
                        "confidence": 0.9,
                    }
                )
            )
            # Bore: smallest dark-filled circle near center
            bore_cands = [
                c
                for c in top_circles
                if c["r"] < radii[0] * 0.7
                and (c["fill"] in dark_fills or c["fill"].startswith("#0") or c["fill"].startswith("#1"))
            ]
            if bore_cands:
                br = min(bore_cands, key=lambda c: c["r"])["r"]
                ir.features.append(
                    Feature(
                        **{
                            "class": FeatureClass.BORE,
                            "params": {"diameter_px": br * 2, "radius_px": br},
                            "view_ids": ["svg_top"],
                            "confidence": 0.9,
                        }
                    )
                )

            # Bolt holes: medium small circles on a ring
            bolt_cands = [
                c
                for c in top_circles
                if 5 <= c["r"] <= 20 and math.hypot(c["cx"] - mx, c["cy"] - my) > radii[0] * 0.4
            ]
            if len(bolt_cands) >= 3:
                pcd = (
                    2
                    * sum(math.hypot(c["cx"] - mx, c["cy"] - my) for c in bolt_cands)
                    / len(bolt_cands)
                )
                avg_r = sum(c["r"] for c in bolt_cands) / len(bolt_cands)
                ir.features.append(
                    Feature(
                        **{
                            "class": FeatureClass.BOLT_CIRCLE,
                            "params": {
                                "count": len(bolt_cands),
                                "pcd_px": pcd,
                                "hole_diameter_px": avg_r * 2,
                            },
                            "view_ids": ["svg_top"],
                            "confidence": 0.85,
                        }
                    )
                )

        # Keyway rect near bore
        for r in rects:
            if r["w"] < 30 and r["h"] < 30 and abs(r["x"] + r["w"] / 2 - mx) < 40:
                ir.features.append(
                    Feature(
                        **{
                            "class": FeatureClass.KEYWAY,
                            "params": {"width_px": r["w"], "depth_px": r["h"]},
                            "view_ids": ["svg_top"],
                            "confidence": 0.7,
                        }
                    )
                )
                break

        ir.views.append(view_top)

    # Front elevation from stacked rects
    if rects:
        # Find transform groups that look like front (wide stacked)
        wide = [r for r in rects if r["w"] > 80 and r["h"] < r["w"]]
        if wide:
            min_x = min(r["x"] for r in wide)
            max_x = max(r["x"] + r["w"] for r in wide)
            min_y = min(r["y"] for r in wide)
            max_y = max(r["y"] + r["h"] for r in wide)
            ir.views.append(
                View(
                    id="svg_front",
                    type=ViewType.FRONT,
                    bbox=BBox(x=min_x, y=min_y, w=max_x - min_x, h=max_y - min_y),
                    label="FRONT ELEVATION (SVG)",
                )
            )
            # Scale estimate: if we have Ø140 and a rect width ~220 in SVG space
            od = next(
                (d for d in ir.dimensions if d.attachment_hint == "outer_diameter"),
                None,
            )
            flange_rects = sorted(wide, key=lambda r: r["w"], reverse=True)
            if od and flange_rects:
                ir.scale_px_per_mm = flange_rects[0]["w"] / od.value
            # Stepped body heights
            total_h = max_y - min_y
            if ir.scale_px_per_mm and total_h > 0:
                # Also capture flange thickness from tallest short rect
                flange = max(wide, key=lambda r: r["w"])
                ir.features.append(
                    Feature(
                        **{
                            "class": FeatureClass.FLANGE,
                            "params": {
                                "width_px": flange["w"],
                                "thickness_px": flange["h"],
                                "stack_height_px": total_h,
                            },
                            "view_ids": ["svg_front"],
                            "confidence": 0.8,
                        }
                    )
                )

    # Infer scale from diameter dims + circle radii
    if ir.scale_px_per_mm is None:
        od_dim = next(
            (d for d in ir.dimensions if d.kind == DimensionKind.DIAMETER and d.value >= 100),
            None,
        )
        outer_feat = next(
            (f for f in ir.features if f.class_ == FeatureClass.OUTER_CYLINDER),
            None,
        )
        if od_dim and outer_feat:
            r_px = outer_feat.params.get("radius_px")
            if r_px:
                ir.scale_px_per_mm = (r_px * 2) / od_dim.value

    if not ir.dimensions:
        ir.uncertainties.append(
            Uncertainty(
                code="no_svg_dimensions",
                message="No dimension text found in SVG",
                severity="warning",
            )
        )

    return ir


def extract_svg_from_data_url(data_url: str) -> Optional[str]:
    if not data_url or not data_url.startswith("data:image/svg"):
        return None
    from urllib.parse import unquote
    import base64

    if ";base64," in data_url:
        return base64.b64decode(data_url.split(",", 1)[1]).decode("utf-8", errors="replace")
    return unquote(data_url.split(",", 1)[1])
