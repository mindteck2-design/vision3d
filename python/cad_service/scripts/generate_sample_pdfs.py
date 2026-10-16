#!/usr/bin/env python3
"""Generate engineering-drawing PDFs for live upload demos.

Professional sheets use white paper / black ink (ISO-style).
Legacy dark demos remain for UI-style samples.

  cd python/cad_service && . .venv/bin/activate
  python scripts/generate_sample_pdfs.py
"""

from __future__ import annotations

import math
from pathlib import Path

from reportlab.lib.colors import HexColor, white, black, Color
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = ROOT / "samples" / "drawings"

# Dark UI demos
BG = HexColor("#0a0f1a")
ACCENT = HexColor("#38bdf8")
MUTED = HexColor("#94a3b8")
FG = HexColor("#e2e8f0")
PANEL = HexColor("#0f172a")
STROKE = HexColor("#334155")

# Print / ISO drawing
WHITE = white
BLACK = black
GRAY = HexColor("#374151")
HATCH = HexColor("#6b7280")
THIN = HexColor("#111827")


def _page_setup(c: canvas.Canvas, title: str, subtitle: str) -> None:
    w, h = landscape(A4)
    c.setFillColor(BG)
    c.rect(0, 0, w, h, fill=1, stroke=0)
    c.setStrokeColor(STROKE)
    c.setLineWidth(2)
    c.rect(18, 18, w - 36, h - 36, fill=0, stroke=1)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(36, h - 48, title)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(36, h - 64, subtitle)


def _dim_table(
    c: canvas.Canvas,
    x: float,
    y: float,
    lines: list[str],
    title: str = "DIMENSIONS (READABLE)",
    *,
    light: bool = False,
) -> None:
    row_h = 12
    box_h = 24 + row_h * len(lines)
    box_w = 260
    if light:
        c.setFillColor(WHITE)
        c.setStrokeColor(BLACK)
        c.setLineWidth(0.7)
        c.rect(x, y - box_h + 16, box_w, box_h, fill=1, stroke=1)
        c.setFillColor(BLACK)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x + 8, y, title)
        c.setFont("Courier", 8)
        yy = y - 14
        for ln in lines:
            c.drawString(x + 8, yy, ln)
            yy -= row_h
        return
    c.setFillColor(PANEL)
    c.setStrokeColor(STROKE)
    c.rect(x, y - box_h + 16, box_w, box_h, fill=1, stroke=1)
    c.setFillColor(ACCENT)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x + 8, y, title)
    c.setFillColor(FG)
    c.setFont("Courier", 9)
    yy = y - 16
    for ln in lines:
        c.drawString(x + 8, yy, ln)
        yy -= row_h


def _arrow(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float, size: float = 4) -> None:
    """Dimension line with filled arrowheads (simplified ISO)."""
    c.setStrokeColor(BLACK)
    c.setFillColor(BLACK)
    c.setLineWidth(0.5)
    c.line(x1, y1, x2, y2)
    ang = math.atan2(y2 - y1, x2 - x1)
    for x, y, a in ((x1, y1, ang), (x2, y2, ang + math.pi)):
        c.saveState()
        c.translate(x, y)
        c.rotate(math.degrees(a))
        p = c.beginPath()
        p.moveTo(0, 0)
        p.lineTo(size, size * 0.35)
        p.lineTo(size, -size * 0.35)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        c.restoreState()


def _centerline(c: canvas.Canvas, x1: float, y1: float, x2: float, y2: float) -> None:
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.4)
    c.setDash([10, 2, 2, 2])
    c.line(x1, y1, x2, y2)
    c.setDash([])


def _hatch_rect(c: canvas.Canvas, x: float, y: float, w: float, h: float, step: float = 4) -> None:
    """Section hatching (approx. ISO 128 metal hatch)."""
    c.saveState()
    c.setStrokeColor(HATCH)
    c.setLineWidth(0.3)
    path = c.beginPath()
    path.rect(x, y, w, h)
    c.clipPath(path, stroke=0)
    # 45-degree hatch
    span = w + h
    for i in range(int(-span), int(span * 2), int(step)):
        c.line(x + i, y, x + i + h, y + h)
    c.restoreState()
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.8)
    c.rect(x, y, w, h, fill=0, stroke=1)


def _iso_title_block(c: canvas.Canvas, page_w: float, page_h: float, meta: dict) -> float:
    """
    ISO 7200-inspired title block (bottom-right).
    Returns top Y of title block for layout clearance.
    """
    tw, th = 320, 100
    x0 = page_w - 25 - tw
    y0 = 25
    c.setStrokeColor(BLACK)
    c.setFillColor(WHITE)
    c.setLineWidth(0.8)
    c.rect(x0, y0, tw, th, fill=1, stroke=1)

    # Columns
    c.setLineWidth(0.4)
    c.line(x0, y0 + 28, x0 + tw, y0 + 28)
    c.line(x0, y0 + 56, x0 + tw, y0 + 56)
    c.line(x0, y0 + 78, x0 + tw, y0 + 78)
    c.line(x0 + 100, y0 + 28, x0 + 100, y0 + 100)
    c.line(x0 + 200, y0 + 28, x0 + 200, y0 + 56)
    c.line(x0 + 160, y0, x0 + 160, y0 + 28)
    c.line(x0 + 240, y0, x0 + 240, y0 + 28)

    c.setFillColor(BLACK)
    c.setFont("Helvetica", 6)
    c.drawString(x0 + 4, y0 + 90, "LEGAL OWNER")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x0 + 4, y0 + 82, meta.get("owner", "VISION3D DEMO"))

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 104, y0 + 90, "DRAWING NUMBER")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x0 + 104, y0 + 82, meta["dwg"])

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 4, y0 + 68, "TITLE")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x0 + 4, y0 + 58, meta["title"])

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 4, y0 + 46, "MATERIAL")
    c.setFont("Helvetica", 8)
    c.drawString(x0 + 4, y0 + 34, meta["material"])

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 104, y0 + 46, "SCALE")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x0 + 104, y0 + 34, meta["scale"])

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 204, y0 + 46, "UNITS")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x0 + 204, y0 + 34, "MM")

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 4, y0 + 18, "TOLERANCE")
    c.setFont("Helvetica", 7)
    c.drawString(x0 + 4, y0 + 8, meta.get("tolerance", "ISO 2768-mK"))

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 164, y0 + 18, "REV")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(x0 + 164, y0 + 8, meta.get("rev", "A"))

    c.setFont("Helvetica", 6)
    c.drawString(x0 + 244, y0 + 18, "SHEET")
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x0 + 244, y0 + 8, meta.get("sheet", "1/1"))

    return y0 + th


def _drawing_frame(c: canvas.Canvas, page_w: float, page_h: float) -> tuple[float, float, float, float]:
    """ISO 5457-style frame with margin and zone marks. Returns inner (x,y,w,h)."""
    margin = 20
    c.setFillColor(WHITE)
    c.rect(0, 0, page_w, page_h, fill=1, stroke=0)
    # Outer trim
    c.setStrokeColor(BLACK)
    c.setLineWidth(1.2)
    c.rect(margin, margin, page_w - 2 * margin, page_h - 2 * margin, fill=0, stroke=1)
    # Inner frame
    c.setLineWidth(0.5)
    inner = 8
    ix = margin + inner
    iy = margin + inner
    iw = page_w - 2 * (margin + inner)
    ih = page_h - 2 * (margin + inner)
    c.rect(ix, iy, iw, ih, fill=0, stroke=1)

    # Zone letters (bottom) / numbers (left) — simplified
    c.setFont("Helvetica", 6)
    c.setFillColor(BLACK)
    cols = "ABCDEFGH"
    for i, ch in enumerate(cols):
        c.drawCentredString(ix + (i + 0.5) * iw / len(cols), margin + 2, ch)
    for i in range(6):
        c.drawCentredString(margin + 4, iy + (i + 0.5) * ih / 6, str(6 - i))

    # First-angle projection symbol (ISO 128)
    sx, sy = ix + 30, iy + 18
    c.setLineWidth(0.6)
    c.circle(sx, sy + 8, 6, fill=0, stroke=1)
    c.circle(sx, sy + 8, 2.5, fill=1, stroke=0)
    c.rect(sx + 12, sy + 2, 14, 12, fill=0, stroke=1)
    c.setFont("Helvetica", 5)
    c.drawString(sx - 8, sy - 8, "1st ANGLE PROJECTION")

    return ix, iy, iw, ih


def write_hydraulic_cylinder_end_cap(path: Path) -> None:
    """
    Professional ISO-style engineering drawing of a hydraulic cylinder end cap
    (manufactured item): white sheet, black ink, title block, section, plan, dims.
    """
    page = landscape(A3)
    c = canvas.Canvas(str(path), pagesize=page)
    w, h = page
    ix, iy, iw, ih = _drawing_frame(c, w, h)
    tb_top = _iso_title_block(
        c,
        w,
        h,
        {
            "owner": "VISION3D / DEMO MFG",
            "dwg": "HCEC-250-80-R",
            "title": "HYDRAULIC CYLINDER END CAP",
            "material": "42CrMo4 +QT  EN 10083",
            "scale": "1:2",
            "tolerance": "ISO 2768-mK / Ra 1.6",
            "rev": "A",
            "sheet": "1/1",
        },
    )

    # Revision table (ISO-style, top-right)
    rx, ry = w - 25 - 160, h - 25 - 50
    c.setLineWidth(0.5)
    c.rect(rx, ry, 160, 50, fill=0, stroke=1)
    c.line(rx, ry + 35, rx + 160, ry + 35)
    c.line(rx + 30, ry, rx + 30, ry + 50)
    c.line(rx + 90, ry, rx + 90, ry + 50)
    c.setFont("Helvetica-Bold", 6)
    c.drawString(rx + 4, ry + 40, "REV")
    c.drawString(rx + 34, ry + 40, "DESCRIPTION")
    c.drawString(rx + 94, ry + 40, "DATE")
    c.setFont("Helvetica", 6)
    c.drawString(rx + 8, ry + 20, "A")
    c.drawString(rx + 34, ry + 20, "Initial release")
    c.drawString(rx + 94, ry + 20, "2026-10-16")

    # Notes block
    nx, ny = ix + 10, iy + 10
    c.setFont("Helvetica-Bold", 7)
    c.drawString(nx, ny + 70, "NOTES")
    c.setFont("Helvetica", 6.5)
    notes = [
        "1. INTERPRET DRAWING PER ISO 128 / ISO 129.",
        "2. UNTOLERANCED DIMENSIONS PER ISO 2768-mK.",
        "3. SURFACE TEXTURE Ra 1.6 UNLESS NOTED.",
        "4. BREAK SHARP EDGES 0.3 x 45 DEG.",
        "5. MAGNETIC PARTICLE INSPECT AFTER HEAT TREAT.",
        "6. ALL DIMENSIONS IN MILLIMETRES.",
    ]
    for i, n in enumerate(notes):
        c.drawString(nx, ny + 58 - i * 9, n)

    # ========== SECTION A-A (front elevation / cut) ==========
    cx, cy = ix + 280, iy + 280
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(BLACK)
    c.drawString(cx - 160, cy + 160, "SECTION A-A")
    c.setFont("Helvetica", 7)
    c.drawString(cx - 160, cy + 148, "(FRONT ELEVATION)")

    # Body outline (turned profile)
    c.setLineWidth(1.0)
    c.setStrokeColor(BLACK)
    # Flange (left)
    c.setFillColor(WHITE)
    c.rect(cx - 150, cy - 90, 36, 180, fill=1, stroke=1)
    _hatch_rect(c, cx - 150, cy - 90, 36, 180, step=5)
    # Barrel
    c.rect(cx - 114, cy - 55, 150, 110, fill=1, stroke=1)
    _hatch_rect(c, cx - 114, cy - 55, 150, 110, step=5)
    # Pilot / rod gland nose
    c.rect(cx + 36, cy - 35, 55, 70, fill=1, stroke=1)
    _hatch_rect(c, cx + 36, cy - 35, 55, 70, step=5)
    # Bore void (cut)
    c.setFillColor(WHITE)
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.9)
    c.rect(cx - 150, cy - 28, 241, 56, fill=1, stroke=1)
    # Seal groove on flange face
    c.setLineWidth(1.2)
    c.line(cx - 148, cy - 78, cx - 116, cy - 78)
    c.line(cx - 148, cy - 72, cx - 116, cy - 72)
    # Keyway
    c.setLineWidth(0.8)
    c.rect(cx + 5, cy + 18, 12, 10, fill=1, stroke=1)

    _centerline(c, cx - 165, cy, cx + 105, cy)

    # Dimension callouts beside view (machine-readable labels)
    c.setFont("Courier", 7)
    c.setFillColor(BLACK)
    c.drawCentredString(cx - 40, cy - 108, "Outer flange  D 250.00 mm")
    c.drawString(cx + 50, cy + 50, "Pilot  D 120.00 mm")
    c.drawString(cx - 230, cy + 8, "Bore  D 80.00 mm")
    c.drawString(cx - 40, cy + 70, "Barrel  D 180.00 mm")
    c.drawString(cx + 100, cy, "Height  110.00 mm")
    c.drawString(cx - 230, cy - 70, "Flange thick  28.00 mm")

    # Linear dim example (overall length)
    _arrow(c, cx - 150, cy - 120, cx + 91, cy - 120, size=3.5)
    c.setFont("Helvetica", 7)
    c.drawCentredString(cx - 30, cy - 130, "110")

    # ========== VIEW B (flange face / plan) ==========
    tx, ty = ix + 720, iy + 320
    c.setFont("Helvetica-Bold", 9)
    c.drawString(tx - 70, ty + 130, "VIEW B")
    c.setFont("Helvetica", 7)
    c.drawString(tx - 70, ty + 118, "(FLANGE FACE)")

    c.setLineWidth(1.0)
    c.setFillColor(WHITE)
    c.circle(tx, ty, 95, fill=1, stroke=1)
    c.circle(tx, ty, 68, fill=0, stroke=1)
    c.circle(tx, ty, 45, fill=0, stroke=1)
    c.setFillColor(WHITE)
    c.circle(tx, ty, 30, fill=1, stroke=1)
    # PCD
    c.setDash(2, 2)
    c.setLineWidth(0.5)
    c.circle(tx, ty, 80, fill=0, stroke=1)
    c.setDash()
    c.setLineWidth(0.8)
    for i in range(8):
        ang = i * math.pi / 4 + math.pi / 8
        c.circle(tx + 80 * math.cos(ang), ty + 80 * math.sin(ang), 5.5, fill=1, stroke=1)
    # Keyway
    c.rect(tx - 6, ty + 24, 12, 9, fill=1, stroke=1)
    _centerline(c, tx - 110, ty, tx + 110, ty)
    _centerline(c, tx, ty - 110, tx, ty + 110)

    c.setFont("Courier", 7)
    c.drawCentredString(tx, ty - 118, "Bolt pattern PCD D 200")
    c.drawString(tx + 105, ty + 5, "Bolt holes  D 14.00 mm x 8")

    # Cutting plane line for A-A on view B
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.9)
    c.setDash(6, 2)
    c.line(tx - 100, ty, tx + 100, ty)
    c.setDash()
    c.setFont("Helvetica-Bold", 8)
    c.drawString(tx - 112, ty + 4, "A")
    c.drawString(tx + 102, ty + 4, "A")

    # Detail C
    dx, dy = ix + 720, iy + 140
    c.setFont("Helvetica-Bold", 8)
    c.drawString(dx - 50, dy + 55, "DETAIL C  (SCALE 2:1)")
    c.setLineWidth(0.7)
    c.circle(dx, dy + 5, 32, fill=0, stroke=1)
    c.rect(dx - 9, dy + 22, 18, 12, fill=1, stroke=1)
    c.setFont("Courier", 7)
    c.drawString(dx + 40, dy + 20, "Keyway width  10.00 mm")
    c.drawString(dx + 40, dy + 8, "Keyway depth  5.00 mm")

    # Tabulated dimensions — source of truth for Vision3D parser (ISO practice: tables OK)
    dims = [
        "Outer flange     D 250.00 mm",
        "Barrel           D 180.00 mm",
        "Pilot            D 120.00 mm",
        "Bore             D 80.00 mm",
        "Height           110.00 mm",
        "Flange thick     28.00 mm",
        "Bolt pattern PCD D 200",
        "Bolt holes       D 14.00 mm x 8",
        "Keyway width     10.00 mm",
        "Keyway depth     5.00 mm",
    ]
    _dim_table(c, ix + 10, h - 90, dims, title="TABULATED DIMENSIONS (READABLE)", light=True)

    # Surface finish / general symbols strip
    c.setFont("Helvetica", 6)
    c.setFillColor(GRAY)
    c.drawString(ix + 10, tb_top + 8, "GENERAL TOLERANCE: ISO 2768-mK    |    SURFACE: Ra 1.6    |    EDGES: ISO 13715")

    c.showPage()
    c.save()


# ----- Legacy dark demos (unchanged look) -----


def write_spindle(path: Path) -> None:
    w, h = landscape(A4)
    c = canvas.Canvas(str(path), pagesize=landscape(A4))
    _page_setup(
        c,
        "PRECISION SPINDLE HOUSING - UNITS: MM",
        "PART: SPH-220-85-K  |  MATERIAL: 42CrMo4 QT  |  SCALE: 1:2",
    )
    cx, cy = 220, 300
    c.setStrokeColor(ACCENT)
    c.setFillColor(HexColor("#e2e8f0"))
    c.rect(cx - 90, cy - 40, 180, 100, fill=1, stroke=1)
    c.rect(cx - 120, cy - 70, 240, 30, fill=1, stroke=1)
    c.setFillColor(BG)
    c.rect(cx - 35, cy - 70, 70, 130, fill=1, stroke=1)
    c.setStrokeColor(HexColor("#ef4444"))
    c.setDash(6, 3)
    c.line(cx, cy - 90, cx, cy + 80)
    c.setDash()
    c.setFillColor(ACCENT)
    c.setFont("Courier-Bold", 9)
    c.drawCentredString(cx, cy - 95, "SECTION A-A (schematic)")
    dims = [
        "Outer flange     D 220.00 mm",
        "Barrel           D 160.00 mm",
        "Pilot            D 110.00 mm",
        "Bore             D 85.00 mm",
        "Height           120.00 mm",
        "Flange thick     22.00 mm",
        "Bolt pattern PCD D 190",
        "Bolt holes       D 12.00 mm x 6",
        "Keyway width     8.00 mm",
        "Keyway depth     4.00 mm",
    ]
    _dim_table(c, 480, h - 120, dims)
    c.setFillColor(MUTED)
    c.setFont("Courier", 8)
    c.drawString(36, 36, "DEMO SHEET - selectable dimension text for CAD")
    c.showPage()
    c.save()


def write_coupling(path: Path) -> None:
    w, h = landscape(A4)
    c = canvas.Canvas(str(path), pagesize=landscape(A4))
    _page_setup(
        c,
        "DUAL-FLANGE COUPLING HUB - UNITS: MM",
        "PART: CFH-180-60  |  MATERIAL: C45N  |  SCALE: 1:1.5",
    )
    cx, cy = 220, 290
    c.setStrokeColor(HexColor("#22d3ee"))
    c.setFillColor(HexColor("#e2e8f0"))
    c.circle(cx, cy, 90, fill=1, stroke=1)
    c.setFillColor(BG)
    c.circle(cx, cy, 35, fill=1, stroke=1)
    c.setStrokeColor(MUTED)
    c.setDash(3, 2)
    c.circle(cx, cy, 70, fill=0, stroke=1)
    c.setDash()
    for i in range(8):
        ang = i * math.pi / 4
        c.setFillColor(BG)
        c.setStrokeColor(HexColor("#22d3ee"))
        c.circle(cx + 70 * math.cos(ang), cy + 70 * math.sin(ang), 5, fill=1, stroke=1)
    c.setFillColor(HexColor("#22d3ee"))
    c.setFont("Courier-Bold", 9)
    c.drawCentredString(cx, cy - 115, "FLANGE FACE A")
    dims = [
        "Outer flange     D 180.00 mm",
        "Barrel           D 120.00 mm",
        "Pilot            D 95.00 mm",
        "Bore             D 60.00 mm",
        "Height           95.00 mm",
        "Flange thick     20.00 mm",
        "Bolt pattern PCD D 150",
        "Bolt holes       D 11.00 mm x 8",
    ]
    _dim_table(c, 480, h - 120, dims)
    c.setFillColor(MUTED)
    c.setFont("Courier", 8)
    c.drawString(36, 36, "DEMO SHEET - selectable dimension text for CAD")
    c.showPage()
    c.save()


def write_baseplate(path: Path) -> None:
    w, h = landscape(A4)
    c = canvas.Canvas(str(path), pagesize=landscape(A4))
    _page_setup(
        c,
        "CNC FIXTURE BASEPLATE - UNITS: MM",
        "PART: FXP-240-180-16  |  MATERIAL: Al 7075-T6  |  SCALE: 1:2",
    )
    cx, cy = 230, 290
    c.setStrokeColor(HexColor("#a78bfa"))
    c.setFillColor(HexColor("#e2e8f0"))
    c.roundRect(cx - 120, cy - 90, 240, 180, 6, fill=1, stroke=1)
    c.setFillColor(BG)
    c.circle(cx, cy, 28, fill=1, stroke=1)
    for ox, oy in [(-90, -60), (90, -60), (-90, 60), (90, 60)]:
        c.circle(cx + ox, cy + oy, 7, fill=1, stroke=1)
    c.setFillColor(HexColor("#a78bfa"))
    c.setFont("Courier-Bold", 9)
    c.drawCentredString(cx, cy - 115, "TOP VIEW")
    dims = [
        "Length           240.00 mm",
        "Width            180.00 mm",
        "Plate thick      16.00 mm",
        "Bore             D 56.00 mm",
        "Corner holes     D 10.00 mm",
    ]
    _dim_table(c, 480, h - 120, dims)
    c.setFillColor(MUTED)
    c.setFont("Courier", 8)
    c.drawString(36, 36, "PRISMATIC BASEPLATE - DEMO SHEET")
    c.showPage()
    c.save()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    targets = [
        (OUT_DIR / "precision_spindle_housing.pdf", write_spindle),
        (OUT_DIR / "dual_flange_coupling_hub.pdf", write_coupling),
        (OUT_DIR / "cnc_fixture_baseplate.pdf", write_baseplate),
        (OUT_DIR / "hydraulic_cylinder_end_cap.pdf", write_hydraulic_cylinder_end_cap),
    ]
    for path, fn in targets:
        fn(path)
        print("wrote", path)


if __name__ == "__main__":
    main()
