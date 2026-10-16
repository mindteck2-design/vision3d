# Sample drawing sources

## Generated (this repo)

| File | How | Notes |
|------|-----|--------|
| `hydraulic_cylinder_end_cap.pdf` | `python/cad_service/scripts/generate_sample_pdfs.py` | ISO-style white sheet, title block, section A–A, tabulated dims. Best demo upload. |
| `precision_spindle_housing.pdf` | same script | Dark UI-style demo |
| `dual_flange_coupling_hub.pdf` | same script | Dark UI-style demo |
| `cnc_fixture_baseplate.pdf` | same script | Dark UI-style demo |

Regenerate:

```bash
cd python/cad_service && source .venv/bin/activate
python scripts/generate_sample_pdfs.py
```

## Downloaded from the internet

| File | Source | License / use |
|------|--------|----------------|
| `internet_cmu_flange_part.pdf` | [CMU 24-688 Flange Part Drawing](https://www.andrew.cmu.edu/course/24-688/handouts/Week%202%20-%203D%20Part%20Design/Problem%20Set%20Assignment/Flange%20Part%20Drawing.pdf) | Course handout (educational). Real CAD-exported engineering drawing with selectable mm text (`P95.00` diameter style). |

Downloaded with:

```bash
curl -kfsSL -o samples/drawings/internet_cmu_flange_part.pdf \
  "https://www.andrew.cmu.edu/course/24-688/handouts/Week%202%20-%203D%20Part%20Design/Problem%20Set%20Assignment/Flange%20Part%20Drawing.pdf"
```

**Proof of concept:** Upload either PDF in the Vision3D UI → 3D tab builds parametric STL from text dimensions (no OCR required when text is selectable).
