"""Image preprocessing for engineering drawings."""

from __future__ import annotations

import base64
import re
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
from PIL import Image


def decode_image_input(
    image_base64: Optional[str] = None,
    svg_text: Optional[str] = None,
    data_url: Optional[str] = None,
) -> tuple[np.ndarray, Optional[str]]:
    """
    Decode input into BGR uint8 image and optional raw SVG string.
    Returns (bgr_image, svg_text_or_none).
    """
    if data_url:
        if data_url.startswith("data:image/svg"):
            # data:image/svg+xml;utf8,<svg...> or ;base64,...
            if ";base64," in data_url:
                raw = base64.b64decode(data_url.split(",", 1)[1])
                svg = raw.decode("utf-8", errors="replace")
            else:
                from urllib.parse import unquote

                svg = unquote(data_url.split(",", 1)[1])
            return rasterize_svg(svg), svg
        if data_url.startswith("data:image"):
            payload = data_url.split(",", 1)[1]
            raw = base64.b64decode(payload)
            return decode_bytes(raw), None

    if svg_text:
        return rasterize_svg(svg_text), svg_text

    if image_base64:
        # Strip data URL prefix if present
        payload = image_base64
        if "," in payload and payload.strip().startswith("data:"):
            payload = payload.split(",", 1)[1]
        raw = base64.b64decode(payload)
        return decode_bytes(raw), None

    raise ValueError("No image or SVG provided")


def decode_bytes(raw: bytes) -> np.ndarray:
    # PDF → first page raster when raw is a PDF
    if raw[:4] == b"%PDF":
        try:
            import fitz

            doc = fitz.open(stream=raw, filetype="pdf")
            page = doc.load_page(0)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            pil = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
        except Exception:
            pass
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        # Fallback via PIL (also handles some formats)
        pil = Image.open(BytesIO(raw)).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def rasterize_svg(svg: str, max_side: int = 1200) -> np.ndarray:
    """Rasterize SVG via cairosvg if available, else OpenCV from PIL fallback."""
    try:
        import cairosvg

        png = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=max_side)
        return decode_bytes(png)
    except Exception:
        pass

    # Minimal fallback: parse viewBox and draw white canvas with dark bg marker
    # Prefer Pillow + svglib when available
    try:
        from io import BytesIO

        from reportlab.graphics import renderPM
        from svglib.svglib import svg2rlg

        drawing = svg2rlg(BytesIO(svg.encode("utf-8")))
        if drawing is not None:
            png_data = renderPM.drawToString(drawing, fmt="PNG")
            return decode_bytes(png_data)
    except Exception:
        pass

    # Last resort: blank canvas sized from viewBox
    m = re.search(r'viewBox=["\']([^"\']+)["\']', svg)
    w, h = 800, 800
    if m:
        parts = m.group(1).split()
        if len(parts) == 4:
            w = max(64, int(float(parts[2])))
            h = max(64, int(float(parts[3])))
    canvas = np.zeros((h, w, 3), dtype=np.uint8)
    canvas[:] = (11, 19, 41)
    return canvas


def preprocess(bgr: np.ndarray) -> dict:
    """
    Deskew-lite, denoise, binarize. Returns dict of useful layers.
    """
    if bgr is None or bgr.size == 0:
        raise ValueError("Empty image")

    h, w = bgr.shape[:2]
    max_side = 1600
    scale = 1.0
    if max(h, w) > max_side:
        scale = max_side / float(max(h, w))
        bgr = cv2.resize(bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # Engineering drawings are often light lines on dark OR dark on light
    mean = float(np.mean(gray))
    if mean < 127:
        # Dark background → invert for consistent processing
        working = 255 - gray
        inverted = True
    else:
        working = gray
        inverted = False

    denoise = cv2.bilateralFilter(working, 5, 50, 50)
    # Adaptive threshold for ink
    binary = cv2.adaptiveThreshold(
        denoise, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 35, 10
    )
    # Object mask: thick strokes (geometry) vs thin (dims) — morphological open
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    geometry = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
    edges = cv2.Canny(denoise, 50, 150)

    return {
        "bgr": bgr,
        "gray": gray,
        "working": working,
        "binary": binary,
        "geometry": geometry,
        "edges": edges,
        "inverted_bg": inverted,
        "scale_applied": scale,
    }
