from fastapi.testclient import TestClient

from app.main import app, _dashboard_data

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_overview_endpoint_matches_database_status() -> None:
    response = client.get("/api/overview")
    assert response.status_code == 200
    payload = response.json()
    assert any(item["label"] == "Data status" for item in payload)
    # Whether the local SQLite file is configured or not, the API should
    # report its true state instead of claiming all metrics are placeholders.
    data = _dashboard_data()
    status_metric = next(item for item in payload if item["label"] == "Data status")
    expected = "Connected" if data["data_status"] == "connected" else data["data_status"].replace("_", " ").title()
    assert status_metric["value"] == expected


def test_dashboard_endpoint_has_expected_shape() -> None:
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["data_status"] in {"connected", "not_configured", "error"}
    assert {"kpis", "trend", "suppliers", "risk_signals", "provenance"} <= payload.keys()
    if payload["data_status"] == "connected":
        assert payload["kpis"]["total_orders"] >= 0
        assert payload["kpis"]["supplier_count"] >= 0
