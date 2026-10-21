from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_overview_is_clearly_placeholder_until_data_integration() -> None:
    response = client.get("/api/overview")
    assert response.status_code == 200
    assert any(item["value"] == "Not enabled" for item in response.json())
