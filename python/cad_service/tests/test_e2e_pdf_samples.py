"""E2E: text-rich sample PDFs reconstruct to STL via the live upload path."""

from __future__ import annotations

import base64
from pathlib import Path

import pytest

from app.pipeline.orchestrator import reconstruct
from app.pipeline.pdf_parse import pdf_bytes_to_ir

SAMPLES = Path(__file__).resolve().parents[3] / "samples" / "drawings"

PDF_CASES = [
    (
        "precision_spindle_housing.pdf",
        {
            "part_class": "revolved",
            "outer": 220.0,
            "height": 120.0,
            "bore": 85.0,
            "bolt_count": 6,
            "bolt_pcd": 190.0,
        },
    ),
    (
        "dual_flange_coupling_hub.pdf",
        {
            "part_class": "revolved",
            "outer": 180.0,
            "height": 95.0,
            "bore": 60.0,
            "bolt_count": 8,
            "bolt_pcd": 150.0,
        },
    ),
    (
        "cnc_fixture_baseplate.pdf",
        {
            "part_class": "prismatic",
            "plate_l": 240.0,
            "plate_w": 180.0,
            "plate_t": 16.0,
            "bore": 56.0,
        },
    ),
]


def _require_pdf(name: str) -> Path:
    path = SAMPLES / name
    if not path.exists():
        pytest.skip(f"Sample PDF missing: {path} (run scripts/generate_sample_pdfs.py)")
    return path


@pytest.mark.parametrize("name,expect", PDF_CASES)
def test_pdf_text_extracts_dims(name: str, expect: dict):
    raw = _require_pdf(name).read_bytes()
    ir = pdf_bytes_to_ir(raw, filename=name)
    assert ir.part_class == expect["part_class"]
    assert len(ir.dimensions) >= 4


@pytest.mark.parametrize("name,expect", PDF_CASES)
def test_pdf_upload_reconstruct_stl(name: str, expect: dict):
    """Mimic UI upload: data:application/pdf;base64,... → reconstruct."""
    raw = _require_pdf(name).read_bytes()
    data_url = "data:application/pdf;base64," + base64.b64encode(raw).decode("ascii")
    resp = reconstruct(image_base64=data_url, filename=name, prefer_svg=True)

    assert resp.stl_base64, f"{name}: expected STL"
    assert resp.status.value in ("complete", "partial")
    solved = resp.solved
    assert solved is not None

    if expect["part_class"] == "prismatic":
        assert solved.plate_length_mm == pytest.approx(expect["plate_l"], abs=0.5)
        assert solved.plate_width_mm == pytest.approx(expect["plate_w"], abs=0.5)
        assert solved.plate_thickness_mm == pytest.approx(expect["plate_t"], abs=0.5)
        assert solved.bore_diameter_mm == pytest.approx(expect["bore"], abs=0.5)
    else:
        assert solved.outer_diameter_mm == pytest.approx(expect["outer"], abs=0.5)
        assert solved.total_height_mm == pytest.approx(expect["height"], abs=0.5)
        assert solved.bore_diameter_mm == pytest.approx(expect["bore"], abs=0.5)
        assert solved.bolt_count == expect["bolt_count"]
        assert solved.bolt_pcd_mm == pytest.approx(expect["bolt_pcd"], abs=0.5)
