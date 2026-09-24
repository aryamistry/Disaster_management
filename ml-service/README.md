# ml-service — NER Landslide ML Inference Service

FastAPI microservice wrapping the trained XGBoost landslide risk model (v2).

## Setup

```bash
# From repo root (Disaster_management/)
python -m venv ml-service/venv

# Windows
ml-service\venv\Scripts\activate

# macOS/Linux
source ml-service/venv/bin/activate

pip install -r ml-service/requirements.txt
```

## Run

```bash
# From repo root
ml-service\venv\Scripts\uvicorn ml-service.main:app --port 8000 --reload

# Or from ml-service/ directory
uvicorn main:app --port 8000 --reload
```

The service expects model artifacts at `../models/` (relative to `ml-service/`):
- `xgboost_landslide_model_v2.json`
- `feature_list_v2.pkl`
- `label_encoders_v2.pkl`
- `risk_thresholds_v2.pkl`
- `model_metadata_v2.json`

**Startup will fail loudly if any artifact is missing.**

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Model status, version, and performance metrics |
| POST | `/predict` | Batch or single grid-cell risk prediction |
| GET | `/explain/{grid_id}` | SHAP feature contributions (stretch goal) |

## POST /predict — Example

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "records": [{
      "grid_id": "G001",
      "elevation_m": 1420,
      "slope_deg": 38.5,
      "aspect_deg": 225,
      "plan_curvature": -0.002,
      "profile_curvature": -0.003,
      "twi": 8.5,
      "dist_to_road_m": 800,
      "dist_to_stream_m": 320,
      "land_cover_type": "Dense Forest",
      "soil_type": "Weathered Gneiss & Mica Schist",
      "rainfall_24h_mm": 85,
      "rainfall_3d_accum_mm": 210,
      "rainfall_7d_accum_mm": 420,
      "rainfall_intensity_mm_h": 12.5,
      "soil_moisture_pct": 72,
      "historical_landslide_density": 0.36
    }]
  }'
```

## Run Tests

```bash
ml-service\venv\Scripts\pytest ml-service/tests/test_predict.py -v
```

## Notes

- **land_cover_type** must be one of 6 exact strings (see `main.py: LAND_COVER_CLASSES`)
- **soil_type** must be one of 14 exact strings (see `main.py: SOIL_TYPE_CLASSES`)
- Predictions are logged to `ml-service/predictions.log`
- Risk thresholds: Low < 0.1884 ≤ Medium < 0.3647 ≤ High < 0.6132 ≤ Critical
- These are recall-targeted heuristics, **not** validated disaster-response standards

## Model Caveats

- Dataset is a 2024 prototype; validation is internal to it only
- Reported metrics (ROC-AUC ~0.99) are NOT evidence of real-world performance
- `historical_landslide_density` temporal provenance requires confirmation
- Risk-bucket thresholds must be re-validated against confirmed real incidents
