"""Parametric solid construction with CADQuery (trimesh fallback)."""

from __future__ import annotations

import logging
import math
import tempfile
from pathlib import Path
from typing import Optional

from app.schemas import ReconstructionStatus, SolvedModel

logger = logging.getLogger(__name__)


def build_solid(solved: SolvedModel) -> tuple[Optional[object], Optional[Path], list[str]]:
    """
    Build parametric solid from SolvedModel.
    Returns (cadquery_workplane_or_none, stl_path, steps).
    """
    steps: list[str] = []
    if solved.status == ReconstructionStatus.INCOMPLETE:
        steps.append("CAD: skipped — incomplete critical dimensions")
        return None, None, steps
    if solved.status == ReconstructionStatus.UNSUPPORTED:
        steps.append("CAD: skipped — unsupported part class")
        return None, None, steps

    try:
        import cadquery as cq

        steps.append("CAD: CADQuery available")
        if solved.part_class == "gear":
            solid = _build_gear_cq(cq, solved)
            steps.append("CAD: built simplified gear disk")
        elif solved.part_class == "prismatic":
            solid = _build_prismatic_cq(cq, solved)
            steps.append("CAD: built prismatic plate")
        elif solved.part_class == "flanged_sleeve":
            solid = _build_flanged_sleeve_cq(cq, solved)
            steps.append("CAD: built flanged sleeve with tapered bore")
        else:
            solid = _build_revolved_cq(cq, solved)
            steps.append("CAD: built revolved flanged housing")

        tmp = Path(tempfile.mkdtemp(prefix="vision3d_cad_"))
        stl_path = tmp / "model.stl"
        step_path = tmp / "model.step"
        # Finer tessellation so cylinders look less faceted in the viewer
        try:
            cq.exporters.export(
                solid, str(stl_path), exportType="STL", tolerance=0.05, angularTolerance=0.08
            )
        except TypeError:
            cq.exporters.export(solid, str(stl_path))
        try:
            cq.exporters.export(solid, str(step_path))
            steps.append(f"CAD: exported STEP {step_path}")
        except Exception as e:
            steps.append(f"CAD: STEP export failed ({e})")
            step_path = None  # type: ignore
        steps.append(f"CAD: exported STL {stl_path}")
        # Attach step path on solid via attribute for orchestrator
        solid._vision3d_step = step_path  # type: ignore[attr-defined]
        return solid, stl_path, steps
    except Exception as e:
        logger.warning("CADQuery build failed, using trimesh fallback: %s", e)
        steps.append(f"CAD: CADQuery failed ({e}); trimesh fallback")
        stl_path = _build_trimesh_fallback(solved)
        return None, stl_path, steps


def _build_flanged_sleeve_cq(cq, s: SolvedModel):
    """Flange OD + body OD + tapered (or cylindrical) bore along Z."""
    flange_od = s.outer_diameter_mm or 26.0
    body_od = s.barrel_diameter_mm or flange_od * 0.85
    h = s.total_height_mm or 26.0
    flange_t = min(s.flange_thickness_mm or 3.0, h * 0.4)
    body_h = max(h - flange_t, 0.5)
    bore_large = s.bore_large_mm or s.bore_diameter_mm
    bore_small = s.bore_small_mm or bore_large
    bore_depth = min(s.bore_depth_mm or h, h)

    flange = cq.Workplane("XY").circle(flange_od / 2).extrude(flange_t)
    body = (
        cq.Workplane("XY")
        .workplane(offset=flange_t)
        .circle(body_od / 2)
        .extrude(body_h)
    )
    solid = flange.union(body)

    if bore_large and bore_large > 0:
        # Bore from flange face (z=0) inward; taper toward free end
        depth = max(bore_depth, 0.5)
        r0 = bore_large / 2
        r1 = (bore_small or bore_large) / 2
        if abs(r0 - r1) < 1e-6:
            solid = solid.cut(cq.Workplane("XY").circle(r0).extrude(depth + 0.2))
        else:
            try:
                taper = (
                    cq.Workplane("XY")
                    .circle(r0)
                    .workplane(offset=depth)
                    .circle(r1)
                    .loft()
                )
                solid = solid.cut(taper)
            except Exception:
                # Stepped approximation
                mid = depth * 0.5
                solid = solid.cut(cq.Workplane("XY").circle(r0).extrude(mid + 0.05))
                solid = solid.cut(
                    cq.Workplane("XY").workplane(offset=mid).circle(r1).extrude(depth - mid + 0.2)
                )
    return solid


def _build_revolved_cq(cq, s: SolvedModel):
    """Flange + barrel + pilot, concentric bore, bolt circle, optional keyway."""
    od = float(s.outer_diameter_mm or 100.0)
    h = float(s.total_height_mm or 50.0)
    bore = float(s.bore_diameter_mm or 0.0)
    flange_t = float(s.flange_thickness_mm or min(18.0, h * 0.25))
    # Never let flange eat the whole height (deformed "two disks" look)
    if flange_t > h * 0.35:
        flange_t = min(18.0, h * 0.24)
    barrel_d = float(s.barrel_diameter_mm or od * 0.6)
    barrel_d = min(max(barrel_d, bore + 4), od * 0.98)
    pilot_d = float(s.pilot_diameter_mm or barrel_d * 0.7)
    pilot_d = min(max(pilot_d, bore + 2), barrel_d * 0.98)

    barrel_h = max(h - flange_t, h * 0.5)
    pilot_h = min(h * 0.2, barrel_h * 0.35)

    flange = cq.Workplane("XY").circle(od / 2).extrude(flange_t)
    barrel = (
        cq.Workplane("XY")
        .workplane(offset=flange_t)
        .circle(barrel_d / 2)
        .extrude(barrel_h - pilot_h)
    )
    pilot = (
        cq.Workplane("XY")
        .workplane(offset=flange_t + barrel_h - pilot_h)
        .circle(pilot_d / 2)
        .extrude(pilot_h)
    )
    solid = flange.union(barrel).union(pilot)

    if bore > 0:
        bore = min(bore, pilot_d * 0.92, barrel_d * 0.85)
        solid = solid.cut(cq.Workplane("XY").circle(bore / 2).extrude(h + 1))

    if s.bolt_pcd_mm and s.bolt_count and s.bolt_hole_diameter_mm:
        r = float(s.bolt_pcd_mm) / 2
        n = int(s.bolt_count)
        hole_r = float(s.bolt_hole_diameter_mm) / 2
        r = min(max(r, barrel_d / 2 + hole_r + 1), od / 2 - hole_r - 0.5)
        for i in range(n):
            ang = 2 * math.pi * i / n
            x, y = r * math.cos(ang), r * math.sin(ang)
            solid = solid.cut(
                cq.Workplane("XY")
                .transformed(offset=(x, y, 0))
                .circle(hole_r)
                .extrude(flange_t + 0.5)
            )

    if bore > 0 and s.keyway_width_mm and s.keyway_depth_mm:
        kw, kd = float(s.keyway_width_mm), float(s.keyway_depth_mm)
        if kw < bore * 0.6 and kd < bore * 0.5:
            solid = solid.cut(
                cq.Workplane("XY")
                .transformed(offset=(0, bore / 2 - kd / 2, 0))
                .box(kw, kd, h + 1, centered=(True, True, False))
            )

    return solid


def _build_prismatic_cq(cq, s: SolvedModel):
    L = s.plate_length_mm or 100
    W = s.plate_width_mm or 100
    T = s.plate_thickness_mm or s.total_height_mm or 10
    solid = cq.Workplane("XY").box(L, W, T)
    # Center hole if bore known
    if s.bore_diameter_mm:
        solid = solid.faces(">Z").workplane().hole(s.bore_diameter_mm)
    for i, d in enumerate(s.hole_diameters_mm[:8]):
        if s.bore_diameter_mm and abs(d - s.bore_diameter_mm) < 1e-6:
            continue
        # Place auxiliary holes on a grid
        ox = (i % 2) * L * 0.25 - L * 0.125
        oy = (i // 2) * W * 0.25 - W * 0.125
        solid = solid.faces(">Z").workplane().center(ox, oy).hole(d)
    return solid


def _build_gear_cq(cq, s: SolvedModel):
    od = s.outer_diameter_mm or s.pitch_diameter_mm or 100
    h = s.total_height_mm or 30
    bore = s.bore_diameter_mm or od * 0.3
    teeth = s.gear_teeth or 0

    solid = cq.Workplane("XY").circle(od / 2).extrude(h)
    if bore > 0:
        solid = solid.cut(cq.Workplane("XY").circle(bore / 2).extrude(h + 1))

    if teeth and teeth > 5:
        # Triangular stub teeth
        tip = od / 2
        root = tip * 0.92
        for i in range(teeth):
            ang = 2 * math.pi * i / teeth
            # Approximate tooth as a small radial box
            tw = math.pi * od / teeth * 0.4
            tooth = (
                cq.Workplane("XY")
                .transformed(rotate=(0, 0, math.degrees(ang)))
                .transformed(offset=(root, 0, 0))
                .box(tip - root + 0.5, tw, h, centered=(False, True, False))
            )
            solid = solid.union(tooth)
    return solid


def _build_trimesh_fallback(s: SolvedModel) -> Optional[Path]:
    try:
        import numpy as np
        import trimesh
    except Exception:
        return None

    if s.part_class == "prismatic":
        L = s.plate_length_mm or 100
        W = s.plate_width_mm or 100
        T = s.plate_thickness_mm or 10
        mesh = trimesh.creation.box(extents=[L, W, T])
    elif s.part_class == "flanged_sleeve":
        od = s.outer_diameter_mm or 26
        h = s.total_height_mm or 26
        mesh = trimesh.creation.cylinder(radius=od / 2, height=h)
        br = (s.bore_large_mm or s.bore_diameter_mm or 0) / 2
        if br > 0:
            bore = trimesh.creation.cylinder(radius=br, height=h + 1)
            mesh = mesh.difference(bore, engine="auto")
    else:
        od = s.outer_diameter_mm or 100
        h = s.total_height_mm or 50
        mesh = trimesh.creation.cylinder(radius=od / 2, height=h)
        if s.bore_diameter_mm:
            bore = trimesh.creation.cylinder(radius=s.bore_diameter_mm / 2, height=h + 1)
            mesh = mesh.difference(bore, engine="auto")

    tmp = Path(tempfile.mkdtemp(prefix="vision3d_cad_"))
    stl_path = tmp / "model.stl"
    mesh.export(stl_path)
    return stl_path


def export_step_base64(solid) -> Optional[bytes]:
    step = getattr(solid, "_vision3d_step", None)
    if step and Path(step).exists():
        return Path(step).read_bytes()
    return None
