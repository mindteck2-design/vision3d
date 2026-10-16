"""Live dimension extraction from engineering drawing rasters.

Order: EasyOCR (pip-only) → pytesseract (if tesseract installed) → PaddleOCR.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import cv2
import numpy as np

from app.schemas import Dimension, DimensionKind, DimensionSource, DrawingIR, Uncertainty

logger = logging.getLogger(__name__)

_EASYOCR = None
_EASYOCR_FAILED = False
_PADDLE = None
_PADDLE_FAILED = False

DIM_PATTERN = re.compile(
    r"(?P<sym>[Ø⌀ø∅φΦRrDd])?\s*(?P<val>\d+(?:\.\d+)?)\s*(?P<unit>mm|cm|in)?",
    re.IGNORECASE,
)
PCD_PATTERN = re.compile(r"PCD\s*[Ø⌀ø∅φΦ]?\s*(\d+(?:\.\d+)?)", re.IGNORECASE)


def _prepare_variants(bgr: np.ndarray) -> list[np.ndarray]:
    """Return image variants that help OCR on CAD drawings."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    scale = 1.0
    if max(h, w) < 1400:
        scale = 1400.0 / max(h, w)
    elif max(h, w) > 2200:
        scale = 2200.0 / max(h, w)
    if abs(scale - 1.0) > 0.05:
        gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA,
        )
    if float(np.mean(gray)) < 127:
        gray = 255 - gray
    blur = cv2.GaussianBlur(gray, (3, 3), 0)
    binary = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 8
    )
    # Color BGR versions for EasyOCR
    return [
        cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR),
        cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR),
    ]


def extract_dimensions_ocr(bgr: np.ndarray, ir: Optional[DrawingIR] = None) -> DrawingIR:
    """Run OCR on drawing image and append Dimension entries to IR."""
    ir = ir or DrawingIR()
    variants = _prepare_variants(bgr)

    # 1) EasyOCR — no system packages required
    before = len(ir.dimensions)
    for img in variants:
        _run_easyocr(img, ir)
        if len(ir.dimensions) - before >= 3:
            break

    # 2) Tesseract if available
    if len(ir.dimensions) - before < 2:
        gray = cv2.cvtColor(variants[-1], cv2.COLOR_BGR2GRAY)
        _run_tesseract(gray, ir)

    # 3) Paddle optional
    if len(ir.dimensions) - before < 2:
        paddle_ir = DrawingIR()
        _run_paddle(bgr, paddle_ir)
        if paddle_ir.dimensions:
            ir = merge_dimensions(ir, paddle_ir)

    # Cluster / re-hint diameters vs lengths for mechanical drawings
    _refine_hints(ir)

    if len(ir.dimensions) == 0:
        ir.uncertainties.append(
            Uncertainty(
                code="ocr_empty",
                message="OCR found no dimension text. Install: pip install easyocr  (or apt install tesseract-ocr)",
                severity="warning",
            )
        )
    return ir


def _run_easyocr(bgr: np.ndarray, ir: DrawingIR) -> int:
    global _EASYOCR, _EASYOCR_FAILED
    before = len(ir.dimensions)
    if _EASYOCR_FAILED:
        return 0
    try:
        if _EASYOCR is None:
            import easyocr

            # English digits/latin; GPU off for broad compatibility
            _EASYOCR = easyocr.Reader(["en"], gpu=False, verbose=False)
        results = _EASYOCR.readtext(bgr)
        for item in results:
            box, text, conf = item[0], item[1], float(item[2])
            text = (text or "").strip()
            if not text or conf < 0.2:
                continue
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            cx, cy = float(sum(xs) / 4), float(sum(ys) / 4)
            _parse_text_into_dims(text, conf, (cx, cy), ir, DimensionSource.OCR)
    except Exception as e:
        logger.warning("EasyOCR unavailable: %s", e)
        _EASYOCR_FAILED = True
        ir.uncertainties.append(
            Uncertainty(
                code="ocr_easyocr_failed",
                message=f"EasyOCR unavailable ({e})",
                severity="info",
            )
        )
    return len(ir.dimensions) - before


def _run_tesseract(gray_or_bin: np.ndarray, ir: DrawingIR) -> int:
    before = len(ir.dimensions)
    try:
        import pytesseract

        configs = ["--psm 11", "--psm 6"]
        for cfg in configs:
            data = pytesseract.image_to_data(
                gray_or_bin, output_type=pytesseract.Output.DICT, config=cfg
            )
            n = len(data["text"])
            for i in range(n):
                text = (data["text"][i] or "").strip()
                if not text:
                    continue
                conf_raw = data["conf"][i]
                conf = float(conf_raw) / 100.0 if conf_raw not in ("-1", -1) else 0.45
                if conf < 0.25:
                    continue
                x = data["left"][i] + data["width"][i] / 2
                y = data["top"][i] + data["height"][i] / 2
                _parse_text_into_dims(text, conf, (x, y), ir, DimensionSource.OCR)
            if len(ir.dimensions) - before >= 2:
                break
        full = pytesseract.image_to_string(gray_or_bin, config="--psm 6")
        for line in full.splitlines():
            line = line.strip()
            if line:
                _parse_text_into_dims(line, 0.55, (0.0, 0.0), ir, DimensionSource.OCR)
    except Exception as e:
        ir.uncertainties.append(
            Uncertainty(
                code="ocr_tesseract_failed",
                message=f"tesseract unavailable ({e})",
                severity="info",
            )
        )
    return len(ir.dimensions) - before


def _run_paddle(bgr: np.ndarray, ir: DrawingIR) -> None:
    global _PADDLE, _PADDLE_FAILED
    if _PADDLE_FAILED:
        return
    try:
        if _PADDLE is None:
            from paddleocr import PaddleOCR

            _PADDLE = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
        result = _PADDLE.ocr(bgr, cls=True)
        lines = result[0] if result else None
        if not lines:
            return
        for item in lines:
            box, (text, conf) = item[0], item[1]
            text = (text or "").strip()
            if not text:
                continue
            cx = sum(p[0] for p in box) / 4.0
            cy = sum(p[1] for p in box) / 4.0
            _parse_text_into_dims(text, float(conf), (cx, cy), ir, DimensionSource.OCR)
    except Exception as e:
        logger.warning("PaddleOCR unavailable: %s", e)
        _PADDLE_FAILED = True


def _parse_text_into_dims(
    text: str,
    conf: float,
    pos: tuple[float, float],
    ir: DrawingIR,
    source: DimensionSource,
) -> None:
    low = text.lower()
    if "unit" in low and "mm" in low:
        ir.units = "mm"
        ir.title_block["units"] = "mm"

    # Skip common non-dimension noise
    if any(k in low for k in ("dwg", "rev", "sheet", "date", "drawn", "check")):
        return

    m_pcd = PCD_PATTERN.search(text)
    if m_pcd:
        _add_dim(
            ir,
            float(m_pcd.group(1)),
            DimensionKind.PCD,
            text,
            conf,
            source,
            pos,
            "bolt_circle",
        )
        return

    normalized = (
        text.replace("φ", "Ø")
        .replace("Φ", "Ø")
        .replace("ø", "Ø")
        .replace("∅", "Ø")
        .replace(",", ".")
        .replace("O", "0")  # common OCR confusion in dim callouts
    )
    # Also catch bare numbers next to diameter words
    if re.search(r"\b(dia|diam|diameter)\b", low):
        for m in re.finditer(r"(\d+(?:\.\d+)?)", normalized):
            _add_dim(
                ir,
                float(m.group(1)),
                DimensionKind.DIAMETER,
                text,
                conf,
                source,
                pos,
                None,
            )

    for m in DIM_PATTERN.finditer(normalized):
        val = float(m.group("val"))
        if val < 1:
            continue
        sym = (m.group("sym") or "").upper()
        unit = (m.group("unit") or "mm").lower()
        if sym in ("Ø", "⌀", "∅", "Φ", "D") or "ø" in text.lower() or "φ" in text.lower():
            kind = DimensionKind.DIAMETER
        elif sym == "R":
            kind = DimensionKind.RADIUS
        else:
            kind = DimensionKind.LINEAR
        hint = _hint_for(kind, val, text)
        _add_dim(ir, val, kind, text, conf, source, pos, hint, unit)


def _add_dim(
    ir: DrawingIR,
    val: float,
    kind: DimensionKind,
    text: str,
    conf: float,
    source: DimensionSource,
    pos: tuple[float, float],
    hint: Optional[str],
    unit: str = "mm",
) -> None:
    if any(
        d.kind == kind and abs(d.value - val) < 1e-6 and d.attachment_hint == hint
        for d in ir.dimensions
    ):
        return
    ir.dimensions.append(
        Dimension(
            value=val,
            kind=kind,
            unit=unit if unit != "°" else "deg",
            text=text,
            confidence=conf,
            source=source,
            position=pos,
            attachment_hint=hint,
        )
    )


def _hint_for(kind: DimensionKind, val: float, text: str) -> Optional[str]:
    t = text.upper()
    if "PCD" in t:
        return "bolt_circle"
    if kind == DimensionKind.DIAMETER:
        if val >= 100:
            return "outer_diameter"
        if val >= 40:
            return "barrel_diameter"
        if val >= 20:
            return "outer_diameter"
        if val >= 8:
            return "bore_diameter"
        return "bolt_hole_diameter"
    if kind == DimensionKind.LINEAR:
        if val >= 40:
            return "total_height"
        if val <= 8:
            return "flange_thickness"
        if 15 <= val <= 35:
            return "total_height"
    return None


def _refine_hints(ir: DrawingIR) -> None:
    """Re-assign hints from the full set of values (better for sleeves/housings)."""
    diams = sorted(
        [d for d in ir.dimensions if d.kind == DimensionKind.DIAMETER],
        key=lambda d: -d.value,
    )
    linears = sorted(
        [d for d in ir.dimensions if d.kind == DimensionKind.LINEAR],
        key=lambda d: -d.value,
    )
    if len(diams) >= 2:
        diams[0].attachment_hint = "outer_diameter"
        if len(diams) >= 2:
            # Second-largest often body OD on flanged sleeves
            if diams[1].value >= diams[0].value * 0.7:
                diams[1].attachment_hint = "barrel_diameter"
            else:
                diams[1].attachment_hint = "bore_diameter"
        if len(diams) >= 3:
            diams[2].attachment_hint = "bore_large"
        if len(diams) >= 4:
            diams[-1].attachment_hint = "bore_small"
            if diams[2].attachment_hint != "bore_large":
                diams[2].attachment_hint = "bore_large"
    if linears:
        # Largest linear that isn't equal to a diameter → length
        diam_vals = {round(d.value, 3) for d in diams}
        for d in linears:
            if round(d.value, 3) not in diam_vals:
                d.attachment_hint = "total_height"
                break
        thin = [d for d in linears if d.value <= 8]
        if thin:
            thin[0].attachment_hint = "flange_thickness"


def merge_dimensions(base: DrawingIR, extra: DrawingIR) -> DrawingIR:
    """Merge OCR dims into base IR."""
    existing = {(d.kind, round(d.value, 3), d.attachment_hint) for d in base.dimensions}
    for d in extra.dimensions:
        key = (d.kind, round(d.value, 3), d.attachment_hint)
        if key not in existing:
            base.dimensions.append(d)
            existing.add(key)
    for u in extra.uncertainties:
        base.uncertainties.append(u)
    if extra.units:
        base.units = extra.units
    base.title_block.update(extra.title_block)
    if extra.part_class and not base.part_class:
        base.part_class = extra.part_class
    for f in extra.features:
        base.features.append(f)
    for a in extra.assumptions:
        base.assumptions.append(a)
    return base
