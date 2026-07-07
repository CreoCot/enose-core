import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

_SRC = Path(__file__).resolve().parent.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from features import curve_features  # noqa: E402

from .schemas import AnalyzeRequest, AnalyzeResponse, FeatureItem  # noqa: E402

app = FastAPI(
    title="E-Nose ML Analysis Service",
    description="Stateless service for calculating features from sensor time series",
)

ML_API_KEY = os.getenv("ML_API_KEY", "nothing")


def _sanitize(obj):
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"detail": _sanitize(exc.errors())})


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if x_api_key != ML_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    return True


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ml"}


@app.post("/analyze", response_model=AnalyzeResponse, status_code=200)
async def analyze(
    req: AnalyzeRequest, _: bool = Depends(verify_api_key)
) -> AnalyzeResponse:
    try:
        features: list[FeatureItem] = []
        for sensor in req.series:
            times = np.fromiter((p.t for p in sensor.points), dtype=float)
            values = np.fromiter((p.value for p in sensor.points), dtype=float)

            feats = curve_features(times, values)
            if not feats:
                raise ValueError(
                    f"sensor_id={sensor.sensor_id}: no points with t >= 0, "
                    "cannot compute features"
                )

            for name, value in feats.items():
                features.append(
                    FeatureItem(sensor_id=sensor.sensor_id, name=name, value=value)
                )

        return AnalyzeResponse(
            features=features, computed_at=datetime.now(timezone.utc)
        )

    except ValueError as exc:
        raise HTTPException(422, f"Feature calculation error: {exc}")
    except Exception as exc:
        raise HTTPException(422, f"Unable to process the request: {exc}")
