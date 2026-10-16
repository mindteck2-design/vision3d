"""FastAPI entrypoint for Vision3D CAD reconstruction service."""

from __future__ import annotations

import base64
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.pipeline.orchestrator import reconstruct
from app.schemas import ReconstructRequest, ReconstructResponse

app = FastAPI(
    title="Vision3D CAD Reconstruction Service",
    version=__version__,
    description="Engineering drawing → parametric CAD pipeline",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    cq_ok = False
    ocr_ok = False
    try:
        import cadquery  # noqa: F401

        cq_ok = True
    except Exception:
        pass
    try:
        from paddleocr import PaddleOCR  # noqa: F401

        ocr_ok = True
    except Exception:
        pass
    return {
        "status": "ok",
        "service": "vision3d-cad",
        "version": __version__,
        "cadquery": cq_ok,
        "paddleocr": ocr_ok,
        "capabilities": [
            "svg_dimension_parse",
            "opencv_feature_detect",
            "constraint_solve",
            "parametric_cad",
            "trimesh_validate",
            "stl_step_export",
        ],
    }


@app.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct_json(body: ReconstructRequest) -> ReconstructResponse:
    return reconstruct(
        image_base64=body.image_base64,
        svg_text=body.svg_text,
        views=body.views,
        filename=body.filename,
        prefer_svg=body.prefer_svg,
    )


@app.post("/reconstruct/upload", response_model=ReconstructResponse)
async def reconstruct_upload(
    file: UploadFile = File(...),
    filename: Optional[str] = Form(None),
) -> ReconstructResponse:
    raw = await file.read()
    name = filename or file.filename or "upload"
    lower = name.lower()
    ctype = (file.content_type or "").lower()
    if lower.endswith(".svg") or ctype.endswith("svg+xml") or ctype.endswith("svg"):
        return reconstruct(svg_text=raw.decode("utf-8", errors="replace"), filename=name)
    if lower.endswith(".pdf") or "pdf" in ctype:
        # Same path as UI upload: data URL → orchestrator pdf_parse → CAD
        data_url = "data:application/pdf;base64," + base64.b64encode(raw).decode("ascii")
        return reconstruct(image_base64=data_url, filename=name, prefer_svg=True)
    b64 = base64.b64encode(raw).decode("ascii")
    return reconstruct(image_base64=b64, filename=name)


def run():
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)


if __name__ == "__main__":
    run()
