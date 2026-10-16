"""Drawing intermediate representation (DrawingIR) and API models."""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ViewType(str, Enum):
    FRONT = "front"
    TOP = "top"
    SIDE = "side"
    ISO = "iso"
    UNKNOWN = "unknown"


class DimensionKind(str, Enum):
    LINEAR = "linear"
    DIAMETER = "diameter"
    RADIUS = "radius"
    ANGLE = "angle"
    PCD = "pcd"


class DimensionSource(str, Enum):
    OCR = "ocr"
    SVG = "svg"
    CV = "cv"
    DERIVED = "derived"


class FeatureClass(str, Enum):
    OUTER_CYLINDER = "outer_cylinder"
    BORE = "bore"
    FLANGE = "flange"
    BOLT_HOLE = "bolt_hole"
    BOLT_CIRCLE = "bolt_circle"
    KEYWAY = "keyway"
    SLOT = "slot"
    EXTRUDE_PROFILE = "extrude_profile"
    STEPPED_BODY = "stepped_body"
    GEAR_DISK = "gear_disk"
    TOOTH = "tooth"


class ReconstructionStatus(str, Enum):
    COMPLETE = "complete"
    PARTIAL = "partial"
    INCOMPLETE = "incomplete"
    UNSUPPORTED = "unsupported"


class BBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class Dimension(BaseModel):
    value: float
    kind: DimensionKind
    unit: str = "mm"
    text: str = ""
    attachment_hint: Optional[str] = None
    confidence: float = 1.0
    source: DimensionSource = DimensionSource.OCR
    position: Optional[tuple[float, float]] = None


class Feature(BaseModel):
    class_: FeatureClass = Field(alias="class")
    params: dict[str, Any] = Field(default_factory=dict)
    view_ids: list[str] = Field(default_factory=list)
    confidence: float = 1.0

    model_config = {"populate_by_name": True}


class View(BaseModel):
    id: str
    type: ViewType = ViewType.UNKNOWN
    bbox: BBox
    features: list[Feature] = Field(default_factory=list)
    label: Optional[str] = None


class Uncertainty(BaseModel):
    code: str
    message: str
    severity: str = "warning"  # info | warning | error


class Assumption(BaseModel):
    code: str
    message: str
    value: Optional[Any] = None


class DrawingIR(BaseModel):
    units: str = "mm"
    scale_px_per_mm: Optional[float] = None
    views: list[View] = Field(default_factory=list)
    dimensions: list[Dimension] = Field(default_factory=list)
    features: list[Feature] = Field(default_factory=list)
    uncertainties: list[Uncertainty] = Field(default_factory=list)
    assumptions: list[Assumption] = Field(default_factory=list)
    part_class: Optional[str] = None  # revolved | prismatic | gear | unsupported
    title_block: dict[str, str] = Field(default_factory=dict)


class SolvedModel(BaseModel):
    """Constraint-resolved parameters for CAD builders."""

    part_class: str
    outer_diameter_mm: Optional[float] = None
    bore_diameter_mm: Optional[float] = None
    total_height_mm: Optional[float] = None
    flange_thickness_mm: Optional[float] = None
    barrel_diameter_mm: Optional[float] = None
    pilot_diameter_mm: Optional[float] = None
    bolt_count: Optional[int] = None
    bolt_pcd_mm: Optional[float] = None
    bolt_hole_diameter_mm: Optional[float] = None
    keyway_width_mm: Optional[float] = None
    keyway_depth_mm: Optional[float] = None
    plate_length_mm: Optional[float] = None
    plate_width_mm: Optional[float] = None
    plate_thickness_mm: Optional[float] = None
    hole_diameters_mm: list[float] = Field(default_factory=list)
    hole_positions_mm: list[tuple[float, float]] = Field(default_factory=list)
    gear_teeth: Optional[int] = None
    pitch_diameter_mm: Optional[float] = None
    # Flanged sleeve (tapered bore)
    bore_large_mm: Optional[float] = None
    bore_small_mm: Optional[float] = None
    bore_depth_mm: Optional[float] = None
    status: ReconstructionStatus = ReconstructionStatus.INCOMPLETE
    uncertainties: list[Uncertainty] = Field(default_factory=list)
    assumptions: list[Assumption] = Field(default_factory=list)
    dimensions_used: list[Dimension] = Field(default_factory=list)


class ValidationReport(BaseModel):
    watertight: bool = False
    volume_mm3: float = 0.0
    bbox_mm: dict[str, float] = Field(default_factory=dict)
    dim_checks: list[dict[str, Any]] = Field(default_factory=list)
    ok: bool = False
    messages: list[str] = Field(default_factory=list)


class ReconstructRequest(BaseModel):
    image_base64: Optional[str] = None
    svg_text: Optional[str] = None
    views: Optional[dict[str, str]] = None  # front/top/side/blueprint as data URLs or base64
    filename: Optional[str] = None
    prefer_svg: bool = True


class ReconstructResponse(BaseModel):
    status: ReconstructionStatus
    drawing_ir: DrawingIR
    solved: Optional[SolvedModel] = None
    validation: Optional[ValidationReport] = None
    stl_base64: Optional[str] = None
    step_base64: Optional[str] = None
    preview_png_base64: Optional[str] = None
    specifications: dict[str, Any] = Field(default_factory=dict)
    processing_ms: float = 0.0
    pipeline_steps: list[str] = Field(default_factory=list)
