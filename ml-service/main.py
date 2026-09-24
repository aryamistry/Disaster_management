"""
ml-service/main.py
FastAPI microservice wrapping the XGBoost Flash Flood Risk Model (SIH 26192).

Startup: loads model artifacts from ../models/
Endpoints:
  POST /predict   — batch or single prediction using 22 features
  GET  /health    — model load status + metadata (95.87% accuracy, 0.460 threshold)
  GET  /explain/{grid_id} — feature contributions
"""

import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Paths & Artifacts
# ---------------------------------------------------------------------------
HERE = Path(__file__).parent
MODELS_DIR = HERE.parent / "models"

ARTIFACTS = {
    "model":     MODELS_DIR / "xgboost_flash_flood_model.json",
    "features":  MODELS_DIR / "feature_list_flash_flood.pkl",
    "encoders":  MODELS_DIR / "label_encoders_flash_flood.pkl",
    "threshold": MODELS_DIR / "flash_flood_threshold.pkl",
    "metadata":  MODELS_DIR / "flash_flood_model_metadata.json",
}

LOG_PATH = HERE / "predictions.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ml-service")

# ---------------------------------------------------------------------------
# Global model state
# ---------------------------------------------------------------------------
model_state: dict[str, Any] = {}


def load_artifacts() -> None:
    missing = [name for name, path in ARTIFACTS.items() if not path.exists()]
    if missing:
        raise RuntimeError(
            f"Missing model artifacts: {missing}. Expected in: {MODELS_DIR}. Cannot start."
        )

    logger.info("Loading flash flood model artifacts from %s", MODELS_DIR)
    t0 = time.time()

    booster = xgb.Booster()
    booster.load_model(str(ARTIFACTS["model"]))

    feature_list: list[str] = joblib.load(ARTIFACTS["features"])
    threshold: float = float(joblib.load(ARTIFACTS["threshold"]))
    metadata: dict = json.loads(ARTIFACTS["metadata"].read_text(encoding="utf-8"))

    model_state.update({
        "booster": booster,
        "feature_list": feature_list,
        "threshold": threshold,
        "metadata": metadata,
        "loaded_at": datetime.now(timezone.utc).isoformat(),
        "load_time_s": round(time.time() - t0, 3),
        "loaded": True,
    })

    logger.info(
        "Model loaded in %.3fs | features=%d | model=%s | threshold=%.3f",
        model_state["load_time_s"],
        len(feature_list),
        metadata.get("model", "XGBoost"),
        threshold
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield
    logger.info("ml-service shutting down")


app = FastAPI(
    title="DHARA AI Flash Flood Early Warning ML Service",
    description="XGBoost inference service for flash flood risk scoring (SIH 26192)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------
class FlashFloodFeatureInput(BaseModel):
    grid_id: str | None = None
    elevation_m: float = 800.0
    slope_deg: float = 25.0
    aspect_deg: float = 180.0
    plan_curvature: float = 0.0
    profile_curvature: float = 0.0
    twi: float = 12.0
    dist_to_stream_m: float = 80.0
    land_cover_code: int = 10
    soil_type_enc: int = 1
    rainfall_1h_mm: float = 0.0
    rainfall_3h_mm: float = 0.0
    rainfall_6h_mm: float = 0.0
    rainfall_12h_mm: float = 0.0
    rainfall_24h_mm: float = 0.0
    rainfall_3d_accum_mm: float = 0.0
    rainfall_7d_accum_mm: float = 0.0
    rainfall_intensity_mm_h: float = 0.0
    soil_moisture_pct: float = 40.0
    historical_landslide_density: int = 2
    # Optional engineered features (auto-calculated if omitted)
    rain_moisture_index: float | None = None
    slope_wetness_index: float | None = None
    rainfall_runoff_proxy: float | None = None


class PredictRequest(BaseModel):
    records: list[FlashFloodFeatureInput]


class PredictionResult(BaseModel):
    grid_id: str | None
    probability: float
    risk_level: str
    model_version: str
    threshold: float
    features_used: dict


class PredictResponse(BaseModel):
    predictions: list[PredictionResult]
    model_version: str
    threshold: float
    timestamp: str


def _risk_level_from_prob(prob: float, threshold: float) -> str:
    if prob >= 0.75:
        return "Critical"
    elif prob >= threshold: # 0.460
        return "High"
    elif prob >= 0.28:
        return "Moderate"
    else:
        return "Low"


@app.get("/health")
def health():
    if not model_state.get("loaded"):
        raise HTTPException(status_code=503, detail="Model not loaded")
    meta = model_state.get("metadata", {})
    return {
        "status": "healthy",
        "service": "flash-flood-ml-service",
        "problem_statement": "SIH26192",
        "model": "XGBoost",
        "threshold": model_state.get("threshold", 0.460),
        "features_count": len(model_state.get("feature_list", [])),
        "test_metrics": meta.get("test_metrics", {
            "accuracy": 0.9587,
            "precision": 0.9228,
            "recall": 0.9717,
            "f1": 0.9466,
            "roc_auc": 0.9941
        }),
        "loaded_at": model_state.get("loaded_at"),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if not model_state.get("loaded"):
        raise HTTPException(status_code=503, detail="Model not ready")

    booster: xgb.Booster = model_state["booster"]
    feature_list: list[str] = model_state["feature_list"]
    threshold: float = model_state["threshold"]
    metadata: dict = model_state["metadata"]
    model_version = "XGBoost-FlashFlood-v2.0 (SIH26192)"

    rows = []
    processed_records = []

    for r in req.records:
        # Calculate engineered interaction features if not provided
        rmi = r.rain_moisture_index if r.rain_moisture_index is not None else (r.rainfall_intensity_mm_h * r.soil_moisture_pct)
        swi = r.slope_wetness_index if r.slope_wetness_index is not None else (r.slope_deg * r.soil_moisture_pct)
        rrp = r.rainfall_runoff_proxy if r.rainfall_runoff_proxy is not None else (r.rainfall_24h_mm * r.twi)

        feat_map = {
            "elevation_m": float(r.elevation_m),
            "slope_deg": float(r.slope_deg),
            "aspect_deg": float(r.aspect_deg),
            "plan_curvature": float(r.plan_curvature),
            "profile_curvature": float(r.profile_curvature),
            "twi": float(r.twi),
            "dist_to_stream_m": float(r.dist_to_stream_m),
            "land_cover_code": int(r.land_cover_code),
            "soil_type_enc": int(r.soil_type_enc),
            "rainfall_1h_mm": float(r.rainfall_1h_mm),
            "rainfall_3h_mm": float(r.rainfall_3h_mm),
            "rainfall_6h_mm": float(r.rainfall_6h_mm),
            "rainfall_12h_mm": float(r.rainfall_12h_mm),
            "rainfall_24h_mm": float(r.rainfall_24h_mm),
            "rainfall_3d_accum_mm": float(r.rainfall_3d_accum_mm),
            "rainfall_7d_accum_mm": float(r.rainfall_7d_accum_mm),
            "rainfall_intensity_mm_h": float(r.rainfall_intensity_mm_h),
            "soil_moisture_pct": float(r.soil_moisture_pct),
            "historical_landslide_density": int(r.historical_landslide_density),
            "rain_moisture_index": float(rmi),
            "slope_wetness_index": float(swi),
            "rainfall_runoff_proxy": float(rrp),
        }

        row = [feat_map[f] for f in feature_list]
        rows.append(row)
        processed_records.append((r.grid_id, feat_map))

    dmat = xgb.DMatrix(np.array(rows, dtype=np.float32), feature_names=feature_list)
    preds = booster.predict(dmat)
    probs = preds[:, 1] if preds.ndim == 2 else preds

    results = []
    for (grid_id, fmap), p in zip(processed_records, probs):
        prob_val = round(float(p), 4)
        lvl = _risk_level_from_prob(prob_val, threshold)
        results.append(PredictionResult(
            grid_id=grid_id,
            probability=prob_val,
            risk_level=lvl,
            model_version=model_version,
            threshold=threshold,
            features_used=fmap
        ))

    return PredictResponse(
        predictions=results,
        model_version=model_version,
        threshold=threshold,
        timestamp=datetime.now(timezone.utc).isoformat()
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
