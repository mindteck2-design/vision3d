"""View segmentation and geometric feature detection (OpenCV)."""

from __future__ import annotations

import math
from typing import Optional

import cv2
import numpy as np

from app.schemas import (
    BBox,
    DimensionKind,
    DrawingIR,
    Feature,
    FeatureClass,
    Uncertainty,
    View,
    ViewType,
)


def detect_views_and_features(layers: dict, ir: DrawingIR) -> DrawingIR:
    """Segment orthographic view regions and detect circles/lines into IR features."""
    bgr = layers["bgr"]
    edges = layers["edges"]
    geometry = layers["geometry"]
    h, w = edges.shape[:2]

    # If SVG path already populated views, still run Hough for scale cross-check
    regions = _segment_view_regions(geometry)
    if not regions and not ir.views:
        regions = [(0, 0, w, h, ViewType.UNKNOWN)]

    for i, (x, y, rw, rh, vtype) in enumerate(regions):
        view_id = f"cv_view_{i}"
        # Skip tiny regions
        if rw < 40 or rh < 40:
            continue
        # Avoid duplicating SVG views if overlapping heavily
        if any(_iou(v.bbox, BBox(x=x, y=y, w=rw, h=rh)) > 0.5 for v in ir.views):
            view_id = next(
                v.id
                for v in ir.views
                if _iou(v.bbox, BBox(x=x, y=y, w=rw, h=rh)) > 0.5
            )
        else:
            # Heuristic view typing from aspect / position
            if vtype == ViewType.UNKNOWN:
                if y > h * 0.45 and rw / max(rh, 1) > 0.7:
                    vtype = ViewType.TOP
                elif y < h * 0.55:
                    vtype = ViewType.FRONT
            ir.views.append(
                View(
                    id=view_id,
                    type=vtype,
                    bbox=BBox(x=float(x), y=float(y), w=float(rw), h=float(rh)),
                )
            )

        roi_edges = edges[y : y + rh, x : x + rw]
        roi_gray = layers["working"][y : y + rh, x : x + rw]
        feats = _detect_circles(roi_edges, roi_gray, view_id, x, y)
        for f in feats:
            ir.features.append(f)

    _estimate_scale(ir)
    _classify_part(ir)
    return ir


def _segment_view_regions(geometry: np.ndarray) -> list[tuple[int, int, int, int, ViewType]]:
    """Find connected components / contours as candidate view bboxes."""
    inv = 255 - geometry if np.mean(geometry) > 127 else geometry
    # Dilate to merge drawing strokes into blobs
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    merged = cv2.dilate(inv, k, iterations=2)
    contours, _ = cv2.findContours(merged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = geometry.shape[:2]
    areas = []
    for c in contours:
        x, y, rw, rh = cv2.boundingRect(c)
        area = rw * rh
        if area < (w * h) * 0.02:
            continue
        if area > (w * h) * 0.95:
            continue
        areas.append((x, y, rw, rh, ViewType.UNKNOWN))
    areas.sort(key=lambda r: r[2] * r[3], reverse=True)
    return areas[:4]


def _detect_circles(
    edges: np.ndarray, gray: np.ndarray, view_id: str, ox: int, oy: int
) -> list[Feature]:
    feats: list[Feature] = []
    if edges.size == 0:
        return feats
    blur = cv2.GaussianBlur(gray, (5, 5), 1.2)
    min_r = max(8, min(edges.shape[:2]) // 30)
    max_r = max(min_r + 1, min(edges.shape[:2]) // 2)
    circles = cv2.HoughCircles(
        blur,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min_r,
        param1=120,
        param2=30,
        minRadius=min_r,
        maxRadius=max_r,
    )
    if circles is None:
        return feats

    circles = np.round(circles[0]).astype(int)
    # Sort by radius descending
    circles = sorted(circles, key=lambda c: c[2], reverse=True)
    if not circles:
        return feats

    # Deduplicate similar circles
    kept = []
    for c in circles:
        if any(math.hypot(c[0] - k[0], c[1] - k[1]) < 8 and abs(c[2] - k[2]) < 6 for k in kept):
            continue
        kept.append(c)

    cx0, cy0, r0 = kept[0]
    feats.append(
        Feature(
            **{
                "class": FeatureClass.OUTER_CYLINDER,
                "params": {
                    "cx_px": float(cx0 + ox),
                    "cy_px": float(cy0 + oy),
                    "radius_px": float(r0),
                    "diameter_px": float(r0 * 2),
                },
                "view_ids": [view_id],
                "confidence": 0.75,
            }
        )
    )

    # Innermost significant circle near center → bore
    centerish = [
        c
        for c in kept[1:]
        if math.hypot(c[0] - cx0, c[1] - cy0) < r0 * 0.25 and c[2] < r0 * 0.85
    ]
    if centerish:
        bore = min(centerish, key=lambda c: c[2])
        feats.append(
            Feature(
                **{
                    "class": FeatureClass.BORE,
                    "params": {
                        "radius_px": float(bore[2]),
                        "diameter_px": float(bore[2] * 2),
                    },
                    "view_ids": [view_id],
                    "confidence": 0.7,
                }
            )
        )

    # Bolt holes on a ring
    ring = [
        c
        for c in kept
        if r0 * 0.35 < math.hypot(c[0] - cx0, c[1] - cy0) < r0 * 0.95 and c[2] < r0 * 0.2
    ]
    if len(ring) >= 3:
        pcd = 2 * sum(math.hypot(c[0] - cx0, c[1] - cy0) for c in ring) / len(ring)
        avg_d = 2 * sum(c[2] for c in ring) / len(ring)
        feats.append(
            Feature(
                **{
                    "class": FeatureClass.BOLT_CIRCLE,
                    "params": {
                        "count": len(ring),
                        "pcd_px": float(pcd),
                        "hole_diameter_px": float(avg_d),
                    },
                    "view_ids": [view_id],
                    "confidence": 0.7,
                }
            )
        )

    return feats


def _estimate_scale(ir: DrawingIR) -> None:
    if ir.scale_px_per_mm:
        return
    diam_dims = [d for d in ir.dimensions if d.kind == DimensionKind.DIAMETER]
    outer = next((f for f in ir.features if f.class_ == FeatureClass.OUTER_CYLINDER), None)
    if diam_dims and outer:
        # Prefer largest diameter dim matched to largest circle
        od = max(diam_dims, key=lambda d: d.value)
        d_px = outer.params.get("diameter_px")
        if d_px and od.value > 0:
            ir.scale_px_per_mm = float(d_px) / od.value


def _classify_part(ir: DrawingIR) -> None:
    texts = " ".join(ir.title_block.values()).lower()
    dim_texts = " ".join(d.text.lower() for d in ir.dimensions)
    blob = texts + " " + dim_texts

    # Keep specific class already set by SVG title / labeled dims
    if ir.part_class in ("flanged_sleeve", "prismatic", "unsupported", "gear"):
        return

    has_circles = any(
        f.class_ in (FeatureClass.OUTER_CYLINDER, FeatureClass.BORE, FeatureClass.BOLT_CIRCLE)
        for f in ir.features
    )
    if "impeller" in blob or "turbine" in blob or "blade" in blob:
        ir.part_class = "unsupported"
        ir.uncertainties.append(
            Uncertainty(
                code="freeform_unsupported",
                message="Impeller/freeform blade geometry is out of v1 solid accuracy scope",
                severity="error",
            )
        )
        return
    if "gear" in blob or "tooth" in blob or "teeth" in blob:
        ir.part_class = "gear"
        return
    if "flanged sleeve" in blob or "sleeve-" in blob:
        ir.part_class = "flanged_sleeve"
        return
    if "hydraulic" in blob or "end cap" in blob or "cylinder cap" in blob:
        ir.part_class = "revolved"
        return
    if has_circles or any(d.kind == DimensionKind.DIAMETER for d in ir.dimensions):
        ir.part_class = "revolved"
        return
    ir.part_class = "prismatic"
    ir.uncertainties.append(
        Uncertainty(
            code="part_class_heuristic",
            message="Classified as prismatic (no strong revolve cues)",
            severity="info",
        )
    )


def _iou(a: BBox, b: BBox) -> float:
    ax2, ay2 = a.x + a.w, a.y + a.h
    bx2, by2 = b.x + b.w, b.y + b.h
    ix1, iy1 = max(a.x, b.x), max(a.y, b.y)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    union = a.w * a.h + b.w * b.h - inter
    return inter / union if union > 0 else 0.0


def merge_multi_view_images(
    view_images: dict[str, np.ndarray],
) -> list[tuple[str, ViewType, np.ndarray]]:
    """Map named view images to typed list for multi-view fusion."""
    mapping = {
        "front_view": ViewType.FRONT,
        "front": ViewType.FRONT,
        "top_view": ViewType.TOP,
        "top": ViewType.TOP,
        "side_view": ViewType.SIDE,
        "side": ViewType.SIDE,
        "blueprint_sheet": ViewType.UNKNOWN,
        "blueprint": ViewType.UNKNOWN,
    }
    out = []
    for key, img in view_images.items():
        vtype = mapping.get(key, ViewType.UNKNOWN)
        out.append((key, vtype, img))
    return out
