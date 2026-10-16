"""End-to-end reconstruction for flanged housing fixture."""

from pathlib import Path

from app.pipeline.orchestrator import reconstruct
from app.schemas import ReconstructionStatus

FIXTURE = Path(__file__).parent / "fixtures" / "flanged_housing.svg"


def test_reconstruct_flanged_housing():
    svg = FIXTURE.read_text()
    resp = reconstruct(svg_text=svg, prefer_svg=True, filename="flanged_housing.svg")

    assert resp.status in (
        ReconstructionStatus.COMPLETE,
        ReconstructionStatus.PARTIAL,
    )
    assert resp.solved is not None
    assert resp.solved.outer_diameter_mm == 140.0
    assert resp.solved.total_height_mm == 75.0
    assert resp.solved.bolt_pcd_mm == 115.0
    assert resp.stl_base64, "Expected STL output"
    assert resp.validation is not None
    assert resp.validation.volume_mm3 > 0

    # BBox should be close to OD × height
    bbox = resp.validation.bbox_mm
    assert abs(max(bbox["x"], bbox["y"]) - 140.0) <= 3.0
    assert abs(bbox["z"] - 75.0) <= 3.0


def test_incomplete_without_critical_dims():
    resp = reconstruct(
        svg_text='<svg xmlns="http://www.w3.org/2000/svg"><text>no dims</text></svg>',
        prefer_svg=True,
    )
    assert resp.status in (
        ReconstructionStatus.INCOMPLETE,
        ReconstructionStatus.UNSUPPORTED,
        ReconstructionStatus.PARTIAL,
    )
    # Without OD/height, should not silently invent a precise solid as COMPLETE
    if resp.status == ReconstructionStatus.INCOMPLETE:
        assert resp.stl_base64 is None
