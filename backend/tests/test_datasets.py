import json
from io import BytesIO

from openpyxl import Workbook

from fastapi.testclient import TestClient

from app.main import _dashboard_data, app
from app.services import datasets

client = TestClient(app)


def test_csv_preview_import_and_dataset_isolation(tmp_path, monkeypatch):
    monkeypatch.setattr(datasets, "DATASETS_DIR", tmp_path)
    original_before = _dashboard_data()
    csv_data = b"shipment_id,supplier,ship_date,delivery_status,inventory_qty\nS-1,Northwind,2026-01-02,On time,42\nS-2,Northwind,2026-01-03,Late,35\n"
    preview = client.post("/api/datasets/preview", files={"file": ("ops.csv", csv_data, "text/csv")})
    assert preview.status_code == 200
    body = preview.json()
    assert body["row_count"] == 2
    assert body["suggested_mappings"]["shipment_id"] == "shipment_id"
    assert body["preview"][0]["supplier"] == "Northwind"

    mapping = {"shipment_id": "shipment_id", "supplier_name": "supplier", "ship_date": "ship_date", "delivery_status": "delivery_status", "inventory_quantity": "inventory_qty"}
    imported = client.post("/api/datasets/import", files={"file": ("ops.csv", csv_data, "text/csv")}, data={"mappings": json.dumps(mapping)})
    assert imported.status_code == 200, imported.text
    dataset_id = imported.json()["dataset_id"]
    dashboard = client.get(f"/api/dashboard?dataset_id={dataset_id}").json()
    assert dashboard["dataset_kind"] == "imported"
    assert dashboard["kpis"]["shipment_on_time_rate"] == 50.0
    assert dashboard["kpis"]["supplier_risk_index"] is None
    assert dashboard["kpis"]["high_risk_inventory_items"] is None
    assert dashboard["risk_signals"] == []
    assert len(dashboard["inventory"]) == 2
    assert len(client.get("/api/datasets").json()) == 2
    assert _dashboard_data() == original_before
    assert list(tmp_path.glob("*.sqlite"))


def test_rejects_unsupported_file_and_invalid_mapping(tmp_path, monkeypatch):
    monkeypatch.setattr(datasets, "DATASETS_DIR", tmp_path)
    invalid = client.post("/api/datasets/preview", files={"file": ("payload.exe", b"not csv", "application/octet-stream")})
    assert invalid.status_code == 422
    csv_data = b"supplier,delivery_status\nNorthwind,On time\n"
    missing_identifier = client.post("/api/datasets/import", files={"file": ("ops.csv", csv_data, "text/csv")}, data={"mappings": json.dumps({"delivery_status": "delivery_status"})})
    assert missing_identifier.status_code == 422
    missing_measure = client.post("/api/datasets/import", files={"file": ("ops.csv", csv_data, "text/csv")}, data={"mappings": json.dumps({"supplier_name": "supplier"})})
    assert missing_measure.status_code == 422


def test_rejects_missing_identifiers_and_non_numeric_measures():
    no_identifier = b"inventory_qty,delivery_status\n10,On time\n"
    response = client.post("/api/datasets/import", files={"file": ("ops.csv", no_identifier, "text/csv")}, data={"mappings": json.dumps({"inventory_quantity": "inventory_qty", "delivery_status": "delivery_status"})})
    assert response.status_code == 422


def test_xlsx_preview_is_supported():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Shipment ID", "Delivery status"])
    sheet.append(["S-10", "On time"])
    content = BytesIO()
    workbook.save(content)
    response = client.post("/api/datasets/preview", files={"file": ("shipments.xlsx", content.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert response.status_code == 200
    assert response.json()["row_count"] == 1
    assert response.json()["preview"][0]["Shipment ID"] == "S-10"


def test_rejects_malformed_rows_missing_values_and_oversized_files():
    malformed = client.post("/api/datasets/preview", files={"file": ("bad.csv", b"shipment_id,delivery_status\nS-1,On time,extra\n", "text/csv")})
    assert malformed.status_code == 422
    missing = b"shipment_id,delivery_status\n,On time\n"
    missing_response = client.post("/api/datasets/import", files={"file": ("missing.csv", missing, "text/csv")}, data={"mappings": json.dumps({"shipment_id": "shipment_id", "delivery_status": "delivery_status"})})
    assert missing_response.status_code == 422
    try:
        datasets.parse_upload("large.csv", b"x" * (datasets.MAX_UPLOAD_BYTES + 1))
    except datasets.DatasetValidationError as error:
        assert "20 MB" in str(error)
    else:
        raise AssertionError("oversized upload was accepted")
    malformed = b"supplier,inventory_qty\nNorthwind,not-a-number\n"
    response = client.post("/api/datasets/import", files={"file": ("ops.csv", malformed, "text/csv")}, data={"mappings": json.dumps({"supplier_name": "supplier", "inventory_quantity": "inventory_qty"})})
    assert response.status_code == 422
