# Sample engineering drawings (upload demos)

Upload these in the Vision3D UI (**Upload** → **3D** tab). They are **not** in the product dropdown.

## What works today

Vision3D builds a **parametric revolved solid** from labeled dimension text:
flange OD + barrel + pilot + bore + bolt circle + keyway (when present).

It does **not** reconstruct complex multi-port housings (side bosses, fillets stacks, taps) from dense CAD PDFs like the CMU flange handout.

## Recommended demos (use these)

| File | Style | Expected 3D |
|------|-------|-------------|
| **`hydraulic_cylinder_end_cap.pdf`** | White ISO-style sheet | OD 250 × H 110, pilot, bore 80, **8× bolts** on PCD 200, keyway |
| `precision_spindle_housing.svg` | Vector SVG | OD 220 housing with bolts + keyway |
| `dual_flange_coupling_hub.svg` | Vector SVG | OD 180 hub, 8× bolts |
| `flanged_sleeve_26.svg` | Vector SVG | Small sleeve with tapered bore |

Regenerate PDFs:

```bash
cd python/cad_service && source .venv/bin/activate
python scripts/generate_sample_pdfs.py
```

## Other samples

| File | Notes |
|------|--------|
| `precision_spindle_housing.pdf` | Dark UI-style PDF (same dims as SVG) |
| `dual_flange_coupling_hub.pdf` | Dark UI-style PDF |
| `cnc_fixture_baseplate.pdf` / `.svg` | Prismatic plate |
| `internet_cmu_flange_part.pdf` | Real internet CAD PDF — dims parse, but **geometry is far simpler than the drawing** (scope limit) |

Sources: [SOURCES.md](SOURCES.md)
