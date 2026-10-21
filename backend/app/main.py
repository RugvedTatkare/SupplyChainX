"""SupplyChainX API entry point."""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .schemas import HealthResponse, Metric

app = FastAPI(
    title="SupplyChainX API",
    description="Supply-chain risk intelligence demo API. Synthetic scenario data is labelled explicitly.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "SupplyChainX_Final_Database.sqlite"


def _dashboard_data() -> dict[str, Any]:
    """Read dashboard metrics from the configured local SQLite database."""
    db_path = Path(os.environ.get("SUPPLYCHAINX_DB_PATH", str(DEFAULT_DB))).expanduser()
    empty: dict[str, Any] = {"kpis": {}, "trend": [], "suppliers": [], "shipments": [], "inventory": [], "risk_signals": []}
    if not db_path.is_file():
        return {
            **empty,
            "data_status": "not_configured",
            "data_message": "SQLite database not found. Set SUPPLYCHAINX_DB_PATH or place the database in backend/data.",
            "database_path": str(db_path),
            "provenance": {
                "historical": "Delivery outcomes are retrospective historical data, not predictions.",
                "synthetic": "Supplier attributes and inventory scenario fields include synthetic or derived data.",
                "forecasting": "Not enabled.",
            },
        }

    try:
        conn = sqlite3.connect(f"file:{db_path.resolve()}?mode=ro", uri=True, timeout=5)
        conn.row_factory = sqlite3.Row
        try:
            tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            required = {"orders", "shipments", "suppliers", "inventory_snapshots", "risk_events"}
            missing = sorted(required - tables)
            if missing:
                raise ValueError("Missing required tables: " + ", ".join(missing))

            total_orders = conn.execute("SELECT COUNT(DISTINCT order_id) FROM orders").fetchone()[0] or 0
            shipment = conn.execute("""
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN delivery_delay_days <= 0 THEN 1 ELSE 0 END) AS on_time,
                       SUM(CASE WHEN delivery_delay_days > 0 THEN 1 ELSE 0 END) AS delayed
                FROM shipments
                WHERE COALESCE(shipment_status, '') NOT LIKE '%CANCEL%'
            """).fetchone()
            supplier = conn.execute("""
                SELECT COUNT(*) AS total, AVG(risk_score) AS avg_risk,
                       SUM(CASE WHEN UPPER(risk_level) IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END) AS high_risk
                FROM suppliers
            """).fetchone()
            latest_snapshot = conn.execute("SELECT MAX(snapshot_date) FROM inventory_snapshots").fetchone()[0]
            inventory = conn.execute("""
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN UPPER(inventory_risk_level) IN ('HIGH', 'CRITICAL') THEN 1 ELSE 0 END) AS high_risk
                FROM inventory_snapshots WHERE snapshot_date = ?
            """, (latest_snapshot,)).fetchone()
            high_risk_events = conn.execute("""
                SELECT COUNT(*) FROM risk_events
                WHERE UPPER(risk_level) IN ('HIGH', 'CRITICAL')
            """).fetchone()[0] or 0

            shipment_total = int(shipment["total"] or 0)
            on_time_count = int(shipment["on_time"] or 0)
            trend = [dict(row) for row in conn.execute("""
                SELECT substr(ship_datetime, 1, 7) AS month, COUNT(*) AS shipments,
                       ROUND(100.0 * AVG(CASE WHEN delivery_delay_days <= 0 THEN 1.0 ELSE 0.0 END), 1) AS on_time_rate,
                       SUM(CASE WHEN delivery_delay_days > 0 THEN 1 ELSE 0 END) AS delayed
                FROM shipments
                WHERE ship_datetime IS NOT NULL
                  AND COALESCE(shipment_status, '') NOT LIKE '%CANCEL%'
                GROUP BY substr(ship_datetime, 1, 7)
                ORDER BY month DESC LIMIT 6
            """)]
            trend.reverse()
            suppliers = [dict(row) for row in conn.execute("""
                SELECT supplier_id, supplier_name, late_delivery_rate, risk_score,
                       risk_level, data_origin, synthetic_scenario
                FROM suppliers ORDER BY risk_score DESC LIMIT 25
            """)]
            for row in suppliers:
                row["risk_score"] = round(float(row["risk_score"] or 0), 1)
                row["late_delivery_rate"] = round(float(row["late_delivery_rate"] or 0) * 100, 1)
                row["risk_level"] = str(row["risk_level"] or "UNKNOWN").upper()
            shipments_recent = [dict(row) for row in conn.execute("""
                SELECT shipment_id, order_id, supplier_count, warehouse_id, order_country,
                       order_region, ship_datetime, scheduled_shipping_days, actual_shipping_days,
                       delivery_delay_days, delivery_status, late_delivery_risk, shipping_mode, shipment_status
                FROM shipments
                WHERE COALESCE(shipment_status, '') NOT LIKE '%CANCEL%'
                ORDER BY ship_datetime DESC LIMIT 40
            """)]
            inventory_rows = [dict(row) for row in conn.execute("""
                SELECT i.inventory_snapshot_id, i.snapshot_date, i.warehouse_id, i.product_id,
                       i.product_id AS product_name, i.supplier_id, i.estimated_daily_demand,
                       i.current_stock, i.reorder_point, i.days_of_cover,
                       i.supplier_lead_time_days, i.inventory_risk_score,
                       i.inventory_risk_level, i.data_origin, i.synthetic_stock_scenario
                FROM inventory_snapshots i
                WHERE i.snapshot_date = ?
                ORDER BY i.inventory_risk_score DESC LIMIT 40
            """, (latest_snapshot,))]
            for row in inventory_rows:
                for key in ("estimated_daily_demand", "current_stock", "reorder_point", "days_of_cover",
                            "supplier_lead_time_days", "inventory_risk_score"):
                    if row.get(key) is not None:
                        row[key] = round(float(row[key]), 2)
            signals = [dict(row) for row in conn.execute("""
                SELECT risk_event_id, entity_type, entity_id, risk_type, risk_score,
                       risk_level, explanation, event_date, data_origin
                FROM risk_events
                ORDER BY CASE UPPER(risk_level)
                    WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                    event_date DESC LIMIT 8
            """)]
            return {
                "data_status": "connected",
                "data_message": "Metrics calculated from the configured SQLite dataset. Synthetic fields are labelled.",
                "kpis": {
                    "total_orders": int(total_orders),
                    "supplier_risk_index": round(float(supplier["avg_risk"] or 0), 1),
                    "supplier_count": int(supplier["total"] or 0),
                    "high_risk_suppliers": int(supplier["high_risk"] or 0),
                    "shipment_on_time_rate": round(on_time_count / shipment_total * 100, 1) if shipment_total else None,
                    "total_shipments": shipment_total,
                    "delayed_shipments": int(shipment["delayed"] or 0),
                    "high_risk_inventory_items": int(inventory["high_risk"] or 0),
                    "inventory_snapshot_rows": int(inventory["total"] or 0),
                    "inventory_snapshot_date": latest_snapshot,
                    "high_critical_risk_events": int(high_risk_events),
                },
                "trend": trend,
                "suppliers": suppliers,
                "shipments": shipments_recent,
                "inventory": inventory_rows,
                "risk_signals": signals,
                "provenance": {
                    "historical": "Shipment and order metrics describe observed historical outcomes, not predictions.",
                    "synthetic": "Supplier identities/attributes, mappings, and inventory scenarios include synthetic or derived data.",
                    "risk_scores": "Prototype calibration scores are not validated industry standards.",
                    "forecasting": "Not enabled.",
                },
            }
        finally:
            conn.close()
    except (sqlite3.Error, ValueError) as exc:
        return {**empty, "data_status": "error", "data_message": f"Database read failed: {exc}",
                "database_path": str(db_path), "provenance": {"forecasting": "Not enabled."}}


@app.get("/", response_model=dict[str, str])
def root() -> dict[str, str]:
    return {"name": "SupplyChainX", "docs": "/docs", "status": "foundation"}


@app.get("/api/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse()


@app.get("/api/overview", response_model=list[Metric], tags=["analytics"])
def overview() -> list[Metric]:
    """Return compact status and core metrics for the API documentation."""
    data = _dashboard_data()
    if data["data_status"] != "connected":
        return [
            Metric(label="Data status", value=data["data_status"].replace("_", " ").title(), detail=data["data_message"]),
            Metric(label="Forecast status", value="Not enabled", detail="Historical data are retrospective"),
        ]
    kpis = data["kpis"]
    return [
        Metric(label="Data status", value="Connected", detail=data["data_message"]),
        Metric(label="Orders", value=kpis["total_orders"], detail="Distinct historical orders"),
        Metric(label="Supplier risk index", value=kpis["supplier_risk_index"], detail="Mean prototype score, 0–100"),
        Metric(label="Shipment on-time rate", value=kpis["shipment_on_time_rate"] if kpis["shipment_on_time_rate"] is not None else "N/A", detail="Historical outcomes, not forecasts"),
    ]


@app.get("/api/dashboard", tags=["analytics"])
def dashboard() -> dict[str, Any]:
    """Return database-backed KPIs, historical trend, supplier rankings, and risk signals."""
    return _dashboard_data()
