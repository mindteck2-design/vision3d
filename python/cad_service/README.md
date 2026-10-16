# Vision3D CAD Reconstruction Service

Python FastAPI service that converts engineering drawings into parametric CAD solids
(OpenCV + optional PaddleOCR + CADQuery + Trimesh).

## Setup

```bash
cd python/cad_service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# OCR for raster uploads (recommended)
sudo apt install -y tesseract-ocr
```

If `cadquery` or `paddleocr` fail to install on your platform, the service still starts:
- SVG / text-PDF dimension parsing works without OCR
- Trimesh cylinder/box fallback is used when CADQuery is missing

**PDF uploads:** require `pypdf` (in `requirements.txt`). Text-based engineering PDFs with labeled dims (`Outer flange D 220.00 mm`) reconstruct like SVG. Scanned PDFs need OCR (optional tesseract / pymupdf).

Generate demo PDFs:

```bash
pip install reportlab pypdf
python scripts/generate_sample_pdfs.py   # writes samples/drawings/*.pdf
```

Optional lighter deps for SVG rasterization:

```bash
pip install cairosvg svglib reportlab
```

## Run

```bash
cd python/cad_service
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health: `GET http://127.0.0.1:8000/health`  
Reconstruct: `POST http://127.0.0.1:8000/reconstruct`

## Dual-process (with React UI)

From repo root:

```bash
./vision3d.sh start    # CAD :8000 + UI :3000
./vision3d.sh stop
```

Or manually: `uvicorn` here, then `npm run dev` in repo root.  
Express proxies `/api/reconstruct` → `CAD_SERVICE_URL` (default `http://127.0.0.1:8000`).

## Tests

```bash
cd python/cad_service
source .venv/bin/activate
pytest -q
```
