"""Unit tests for SVG dimension / geometry fast-path."""

from pathlib import Path

from app.pipeline.svg_parse import parse_svg_to_ir
from app.schemas import DimensionKind, FeatureClass

FIXTURE = Path(__file__).parent / "fixtures" / "flanged_housing.svg"


def test_extracts_key_dimensions():
    svg = FIXTURE.read_text()
    ir = parse_svg_to_ir(svg)
    values = {(d.kind, d.value) for d in ir.dimensions}

    assert (DimensionKind.DIAMETER, 140.0) in values
    assert (DimensionKind.DIAMETER, 85.0) in values
    assert (DimensionKind.LINEAR, 75.0) in values
    assert any(d.kind == DimensionKind.PCD and d.value == 115.0 for d in ir.dimensions)


def test_extracts_top_plan_features():
    ir = parse_svg_to_ir(FIXTURE.read_text())
    classes = {f.class_ for f in ir.features}
    assert FeatureClass.OUTER_CYLINDER in classes
    assert FeatureClass.BORE in classes
    assert FeatureClass.BOLT_CIRCLE in classes


def test_units_mm():
    ir = parse_svg_to_ir(FIXTURE.read_text())
    assert ir.units == "mm"
