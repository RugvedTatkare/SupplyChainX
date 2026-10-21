"""SupplyChainX API entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import HealthResponse, Metric

app = FastAPI(
    title="SupplyChainX API",
    description="Supply-chain risk intelligence demo API. Synthetic scenario data is labelled explicitly.",
    version="0.1.0",
)

# Local development defaults. Production origins should be configured explicitly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/", response_model=dict[str, str])
def root() -> dict[str, str]:
    return {"name": "SupplyChainX", "docs": "/docs", "status": "foundation"}


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse()


@app.get("/api/overview", response_model=list[Metric], tags=["analytics"])
def overview() -> list[Metric]:
    """Return placeholder metrics until the validated data layer is wired in."""
    return [
        Metric(label="Data status", value="Demo", detail="Data integration is the next step"),
        Metric(label="Forecast status", value="Not enabled", detail="Historical data are retrospective"),
    ]
