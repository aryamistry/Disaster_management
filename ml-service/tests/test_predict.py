"""
Tests for ml-service /predict endpoint.
Run: pytest ml-service/tests/test_predict.py -v
"""
import sys
from pathlib import Path
import pytest

# Allow importing main without starting the server
sys.path.insert(0, str(Path(__file__).parent.parent))

# Test the core logic functions directly (no server needed)
VALID_RECORD = {
    "grid_id": "G001",
    "elevation_m": 1420.0,
    "slope_deg": 38.5,
    "aspect_deg": 225.0,
    "plan_curvature": -0.002,
    "profile_curvature": -0.003,
    "twi": 8.5,
    "dist_to_road_m": 800.0,
    "dist_to_stream_m": 320.0,
    "land_cover_type": "Dense Forest",
    "soil_type": "Weathered Gneiss & Mica Schist",
    "rainfall_24h_mm": 85.0,
    "rainfall_3d_accum_mm": 210.0,
    "rainfall_7d_accum_mm": 420.0,
    "rainfall_intensity_mm_h": 12.5,
    "soil_moisture_pct": 72.0,
    "historical_landslide_density": 0.36,
}


def test_risk_level_thresholds():
    from main import _risk_level_from_prob
    thresholds = {"low_edge": 0.1884, "high_edge": 0.3647, "critical_edge": 0.6132}
    assert _risk_level_from_prob(0.05, thresholds) == "Low"
    assert _risk_level_from_prob(0.20, thresholds) == "Medium"
    assert _risk_level_from_prob(0.40, thresholds) == "High"
    assert _risk_level_from_prob(0.70, thresholds) == "Critical"
    # Edge cases
    assert _risk_level_from_prob(0.1884, thresholds) == "Medium"
    assert _risk_level_from_prob(0.3647, thresholds) == "High"
    assert _risk_level_from_prob(0.6132, thresholds) == "Critical"


def test_valid_land_cover_classes():
    from main import LAND_COVER_CLASSES, FeatureInput
    for cls in LAND_COVER_CLASSES:
        rec = {**VALID_RECORD, "land_cover_type": cls}
        fi = FeatureInput(**rec)
        assert fi.land_cover_type == cls


def test_invalid_land_cover_raises():
    from pydantic import ValidationError
    from main import FeatureInput
    with pytest.raises(ValidationError):
        FeatureInput(**{**VALID_RECORD, "land_cover_type": "Jungle"})


def test_valid_soil_types():
    from main import SOIL_TYPE_CLASSES, FeatureInput
    for st in SOIL_TYPE_CLASSES:
        rec = {**VALID_RECORD, "soil_type": st}
        fi = FeatureInput(**rec)
        assert fi.soil_type == st


def test_invalid_soil_raises():
    from pydantic import ValidationError
    from main import FeatureInput
    with pytest.raises(ValidationError):
        FeatureInput(**{**VALID_RECORD, "soil_type": "Rock"})


def test_full_prediction_pipeline():
    """Integration test: load artifacts and run a real prediction."""
    from main import load_artifacts, model_state, _encode_and_predict, FeatureInput
    load_artifacts()
    assert model_state["loaded"] is True

    rec = FeatureInput(**VALID_RECORD)
    results = _encode_and_predict([rec])

    assert len(results) == 1
    r = results[0]
    assert 0.0 <= r.probability <= 1.0
    assert r.risk_level in ("Low", "Medium", "High", "Critical")
    assert r.grid_id == "G001"
    print(f"\nPrediction: prob={r.probability:.4f}, risk={r.risk_level}")


def test_batch_prediction():
    """Test batch of 10 records (all pilot grid cells)."""
    from main import load_artifacts, model_state, _encode_and_predict, FeatureInput
    load_artifacts()

    records = [FeatureInput(**{**VALID_RECORD, "grid_id": f"G{i:03d}", "slope_deg": 20 + i * 3})
               for i in range(1, 11)]
    results = _encode_and_predict(records)

    assert len(results) == 10
    risk_levels = {r.risk_level for r in results}
    print(f"\nBatch risk levels: {[r.risk_level for r in results]}")
    # Should produce a spread (not necessarily all 4 levels, but valid)
    assert risk_levels.issubset({"Low", "Medium", "High", "Critical"})
