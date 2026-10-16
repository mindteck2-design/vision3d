"""Extract text/SVG-like dimension content from PDF engineering drawings."""

from __future__ import annotations

import logging
import re
from typing import Optional

from app.pipeline.svg_parse import parse_svg_to_ir
from app.schemas import DrawingIR, Uncertainty

logger = logging.getLogger(__name__)

_DIA_SYM = re.compile(r"[Ø⌀ø∅φΦ]|(\bDIA\b)", re.IGNORECASE)

# Lines that look like real engineering dim callouts / table rows
_DIM_KEEP = re.compile(
    r"(outer\s*flange|barrel|pilot|bore|height|flange\s*thick|plate\s*thick|"
    r"bolt\s*pattern|bolt\s*holes|keyway|length|width|corner\s*holes|"
    r"pcd|tabulated)",
    re.IGNORECASE,
)

# Title-block / standards noise that must never become dims
_DIM_REJECT = re.compile(
    r"(iso\s*\d|en\s*\d|drawing number|legal owner|projection|tolerance|"
    r"surface|sheet\s*\d|rev\b|scale\s*:|material|general|interpret|"
    r"magnetic|break sharp|initial release|vision3d|demo mfg|"
    r"^\s*[A-H]\s*$|^\s*\d\s*$)",
    re.IGNORECASE,
)


def pdf_bytes_to_ir(raw: bytes, filename: Optional[str] = None) -> DrawingIR:
    """
    Parse PDF: prefer embedded text → DrawingIR (via svg_parse label path).
    Falls back to CAD-export diameter notation (P95.00 / 95.00P), then OCR.
    """
    ir = DrawingIR(units="mm")
    text = _extract_pdf_text(raw)
    if text.strip():
        ir = _ir_from_plain_text(text)
        if filename:
            ir.title_block["filename"] = filename
        _apply_part_class_from_text(ir, text, filename)
        if len(ir.dimensions) >= 2:
            return ir
        # Internet CAD PDFs often use P##.## for diameters without word labels
        cad_ir = _ir_from_cad_export_text(text, filename=filename)
        if len(cad_ir.dimensions) >= 2:
            return cad_ir

    try:
        bgr = _pdf_first_page_bgr(raw)
        if bgr is not None:
            from app.pipeline.ocr_dims import extract_dimensions_ocr, merge_dimensions

            ocr_ir = extract_dimensions_ocr(bgr)
            ir = merge_dimensions(ir, ocr_ir)
    except Exception as e:
        ir.uncertainties.append(
            Uncertainty(code="pdf_raster_failed", message=str(e), severity="info")
        )

    if len(ir.dimensions) < 2:
        ir.uncertainties.append(
            Uncertainty(
                code="pdf_few_dims",
                message="PDF had little readable dimension text; use text-based PDFs with labeled D/mm dims",
                severity="warning",
            )
        )
    return ir


def _extract_pdf_text(raw: bytes) -> str:
    try:
        from io import BytesIO

        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw))
        parts = []
        for page in reader.pages[:3]:
            parts.append(page.extract_text() or "")
        return "\n".join(parts)
    except Exception as e:
        logger.info("pypdf text extract failed: %s", e)
        return ""


def _pdf_first_page_bgr(raw: bytes):
    try:
        import cv2
        import fitz  # pymupdf
        import numpy as np

        doc = fitz.open(stream=raw, filetype="pdf")
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def _normalize_dim_line(line: str) -> str:
    s = line.strip()
    if not s:
        return s
    s = _DIA_SYM.sub("D", s)
    s = re.sub(r"\bD\s+D\b", "D", s)
    return s


def _filter_dim_lines(lines: list[str]) -> list[str]:
    """Keep only labeled dimension rows; drop ISO title-block / note noise."""
    kept: list[str] = []
    # Prefer tabulated block if present
    in_table = False
    table_lines: list[str] = []
    for ln in lines:
        low = ln.lower()
        if "tabulated dimensions" in low or low.startswith("dimensions (readable)"):
            in_table = True
            continue
        if in_table:
            if _DIM_REJECT.search(ln) and not _DIM_KEEP.search(ln):
                in_table = False
                continue
            if _DIM_KEEP.search(ln) or re.search(r"\bD\s*\d", ln) or re.search(r"\d+\.\d+\s*mm", ln, re.I):
                table_lines.append(ln)
            elif ln.strip() == "" or "notes" in low:
                in_table = False
            continue

    if len(table_lines) >= 3:
        return table_lines

    for ln in lines:
        if _DIM_REJECT.search(ln) and not _DIM_KEEP.search(ln):
            continue
        if not _DIM_KEEP.search(ln):
            continue
        # Reject bare zone letters / years / standard numbers alone
        if re.fullmatch(r"\d{4}", ln.strip()):
            continue
        kept.append(ln)
    return kept


def _apply_part_class_from_text(
    ir: DrawingIR, text: str, filename: Optional[str] = None
) -> None:
    low = text.lower()
    fname = (filename or "").lower()
    blob = low + " " + fname
    if "flanged sleeve" in blob:
        ir.part_class = "flanged_sleeve"
    elif "fixture baseplate" in blob or "cnc fixture baseplate" in blob:
        ir.part_class = "prismatic"
    elif any(
        k in blob
        for k in (
            "hydraulic",
            "end cap",
            "spindle housing",
            "coupling hub",
            "flanged housing",
            "bearing housing",
            "flange",
        )
    ):
        ir.part_class = "revolved"


def _ir_from_cad_export_text(text: str, filename: Optional[str] = None) -> DrawingIR:
    """
    Parse CAD-exported drawings where diameters appear as P95.00 / 95.00P
    (common when Ø glyph is lost) and linears are bare millimetre values.
    Builds a synthetic labeled table for svg_parse / solve.
    """
    from app.schemas import Assumption

    diams: list[float] = []
    for a, b in re.findall(r"[Pp]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*[Pp]\b", text):
        v = a or b
        if v:
            diams.append(float(v))
    diams = sorted({round(v, 3) for v in diams if 3.0 <= v <= 500.0}, reverse=True)

    diam_set = set(diams)
    linears: list[float] = []
    for m in re.findall(r"(?<![Pp\d.])(\d+(?:\.\d+)?)(?![Pp\d])", text):
        v = float(m)
        if v in diam_set:
            continue
        if 2.0 <= v <= 500.0:
            linears.append(v)
    linears = sorted({round(v, 3) for v in linears}, reverse=True)

    if len(diams) < 2:
        return DrawingIR(units="mm")

    height_cands = [v for v in linears if 8.0 <= v <= 120.0]
    height = min(height_cands, key=lambda v: abs(v - 25.0)) if height_cands else None
    flange_cands = [v for v in linears if 2.0 <= v <= 20.0 and v != height]
    flange_t = min(flange_cands, key=lambda v: abs(v - 8.0)) if flange_cands else None

    # Prefer a mid bore (counterbore / ID), not tiny bolt holes
    bore_cands = [
        d for d in diams if diams[0] * 0.15 <= d <= diams[0] * 0.55 and d >= 12.0
    ]
    bore = (
        min(bore_cands, key=lambda d: abs(d - diams[0] * 0.35))
        if bore_cands
        else None
    )

    lines = [
        "FLANGED HOUSING - UNITS: MM",
        "DIMENSIONS (READABLE):",
        f"Outer flange     D {diams[0]:.2f} mm",
    ]
    if len(diams) >= 2:
        lines.append(f"Barrel           D {diams[1]:.2f} mm")
    if bore is not None:
        lines.append(f"Bore             D {bore:.2f} mm")
    if height is not None:
        lines.append(f"Height           {height:.2f} mm")
    if flange_t is not None:
        lines.append(f"Flange thick     {flange_t:.2f} mm")
    bolt_cands = [d for d in diams if 4.0 <= d <= 16.0]
    if bolt_cands and len(diams) >= 4:
        lines.append(f"Bolt holes       D {min(bolt_cands):.2f} mm x 4")

    svg_parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">',
        '<rect width="800" height="600" fill="white"/>',
    ]
    y = 20
    for ln in lines:
        esc = ln.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        svg_parts.append(
            f'<text x="20" y="{y}" font-family="monospace" font-size="12">{esc}</text>'
        )
        y += 16
    svg_parts.append("</svg>")
    ir = parse_svg_to_ir("\n".join(svg_parts))
    if filename:
        ir.title_block["filename"] = filename
        ir.title_block["source"] = "internet_cad_export"
    _apply_part_class_from_text(ir, text, filename)
    if not ir.part_class:
        ir.part_class = "revolved"
    ir.assumptions.append(
        Assumption(
            code="cad_export_dims",
            message="Diameters inferred from P##.## CAD export notation",
            value=len(diams),
        )
    )
    return ir


def _ir_from_plain_text(text: str) -> DrawingIR:
    """Build IR from PDF plain text lines (same label style as SVG samples)."""
    raw_lines = [_normalize_dim_line(ln) for ln in text.splitlines() if ln.strip()]
    # Always include a title cue line for part_class if present in original text
    title_cue = []
    for ln in raw_lines:
        low = ln.lower()
        if any(
            k in low
            for k in (
                "hydraulic cylinder end cap",
                "precision spindle housing",
                "dual-flange coupling",
                "cnc fixture baseplate",
                "flanged sleeve",
            )
        ):
            title_cue.append(ln)
            break
    dim_lines = _filter_dim_lines(raw_lines)
    lines = title_cue + ["UNITS: MM"] + dim_lines

    svg_parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">',
        '<rect width="800" height="800" fill="white"/>',
    ]
    y = 20
    for ln in lines:
        esc = (
            ln.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
        )
        svg_parts.append(
            f'<text x="20" y="{y}" font-family="monospace" font-size="12">{esc}</text>'
        )
        y += 14
        if y > 780:
            break
    svg_parts.append("</svg>")
    return parse_svg_to_ir("\n".join(svg_parts))
