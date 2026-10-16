"""E2E: golden Engineering_drawing definition PNG → flanged sleeve ~26mm."""

from pathlib import Path
import base64

from app.pipeline.orchestrator import reconstruct
from app.schemas import ReconstructionStatus

FIXTURE = Path(__file__).parent / "fixtures" / "Engineering_drawing-dessin_de_definition.png"


def test_definition_drawing_builds_stl_near_26mm():
    assert FIXTURE.exists(), f"missing fixture {FIXTURE}"
    raw = FIXTURE.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    resp = reconstruct(
        image_base64=b64,
        filename="Engineering_drawing-dessin_de_definition.png",
        prefer_svg=True,
    )

    assert resp.status in (
        ReconstructionStatus.COMPLETE,
        ReconstructionStatus.PARTIAL,
    ), resp.pipeline_steps
    assert resp.stl_base64, "expected STL from flanged sleeve"
    assert resp.solved is not None
    assert resp.solved.outer_diameter_mm == 26.0
    assert resp.solved.total_height_mm == 26.0
    assert resp.solved.barrel_diameter_mm == 22.0
    assert resp.validation is not None
    bbox = resp.validation.bbox_mm
    xy = max(bbox["x"], bbox["y"])
    z = bbox["z"]
    assert abs(xy - 26.0) <= 1.5, bbox
    assert abs(z - 26.0) <= 1.5, bbox
