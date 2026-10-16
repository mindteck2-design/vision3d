"""Model validation against extracted dimensions."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.schemas import SolvedModel, ValidationReport


def validate_model(stl_path: Optional[Path], solved: SolvedModel) -> ValidationReport:
    report = ValidationReport()
    if stl_path is None or not Path(stl_path).exists():
        report.messages.append("No STL to validate")
        report.ok = False
        return report

    try:
        import trimesh

        mesh = trimesh.load(str(stl_path), force="mesh")
        if isinstance(mesh, trimesh.Scene):
            mesh = trimesh.util.concatenate(tuple(mesh.geometry.values()))

        report.watertight = bool(getattr(mesh, "is_watertight", False))
        report.volume_mm3 = float(mesh.volume) if report.watertight else float(abs(mesh.volume))
        bounds = mesh.bounds  # (2,3)
        extents = bounds[1] - bounds[0]
        report.bbox_mm = {
            "x": float(extents[0]),
            "y": float(extents[1]),
            "z": float(extents[2]),
        }

        def check(name: str, expected: Optional[float], actual: Optional[float], tol_frac=0.05, tol_abs=0.75):
            if expected is None or actual is None:
                return
            err = abs(actual - expected)
            ok = err <= max(tol_abs, tol_frac * abs(expected))
            report.dim_checks.append(
                {
                    "name": name,
                    "expected_mm": expected,
                    "actual_mm": round(actual, 3),
                    "error_mm": round(err, 3),
                    "ok": ok,
                }
            )

        # XY extent ≈ OD for revolved / sleeve parts
        xy = max(report.bbox_mm["x"], report.bbox_mm["y"])
        z = report.bbox_mm["z"]
        check("outer_diameter", solved.outer_diameter_mm, xy)
        check("total_height", solved.total_height_mm, z)
        if solved.barrel_diameter_mm and solved.part_class == "flanged_sleeve":
            # Body OD is smaller than flange; no bbox check required
            pass
        if solved.plate_length_mm:
            check("plate_length", solved.plate_length_mm, report.bbox_mm["x"])
        if solved.plate_width_mm:
            check("plate_width", solved.plate_width_mm, report.bbox_mm["y"])

        failed = [c for c in report.dim_checks if not c["ok"]]
        if not report.watertight:
            report.messages.append("Mesh is not watertight")
        if report.volume_mm3 <= 0:
            report.messages.append("Non-positive volume")
        if failed:
            report.messages.append(f"{len(failed)} dimension check(s) failed")

        report.ok = (
            report.volume_mm3 > 0
            and (report.watertight or report.volume_mm3 > 0)
            and len(failed) == 0
        )
        if report.ok:
            report.messages.append("Validation passed")
    except Exception as e:
        report.ok = False
        report.messages.append(f"Validation error: {e}")

    return report
