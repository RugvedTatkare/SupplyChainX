"""Typed response models used by the dashboard API."""
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "SupplyChainX API"
    version: str = "0.1.0"


class Metric(BaseModel):
    label: str
    value: int | float | str
    detail: str | None = None


class SupplierRisk(BaseModel):
    supplier_id: str
    supplier_name: str
    risk_score: float = Field(ge=0, le=100)
    risk_band: str
    explanation: str


class RiskSummary(BaseModel):
    total_suppliers: int
    high_risk_suppliers: int
    medium_risk_suppliers: int
    low_risk_suppliers: int
    provenance_note: str
