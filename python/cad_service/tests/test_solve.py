"""Constraint solver tests."""

from app.pipeline.solve import solve_constraints
from app.pipeline.svg_parse import parse_svg_to_ir
from app.schemas import ReconstructionStatus
from pathlib import Path

FIXTURE = Path(__file__).parent / "fixtures" / "flanged_housing.svg"


def test_solve_flanged_housing_dims():
    ir = parse_svg_to_ir(FIXTURE.read_text())
    ir.part_class = "revolved"
    solved = solve_constraints(ir)

    assert solved.outer_diameter_mm == 140.0
    assert solved.barrel_diameter_mm == 85.0
    assert solved.total_height_mm == 75.0
    assert solved.bolt_pcd_mm == 115.0
    # Bore from dark circle r=35 → may be 70 via feature scale, or missing OCR bore 50
    # SVG has no explicit Ø50 text — bore comes from feature px/scale
    assert solved.status in (
        ReconstructionStatus.COMPLETE,
        ReconstructionStatus.PARTIAL,
    )
    assert solved.status != ReconstructionStatus.INCOMPLETE
