"""Uji perilaku API saat berjalan di AWS Lambda: path tulis di /tmp, tiruan SAP di proses yang sama, CORS
dashboard, dan handler Mangum untuk event Lambda Function URL."""

import json
from pathlib import Path

from mangum import Mangum

from api.main import create_app, siapkan, tutup
from api.settings import Settings
from tests.api_data import buat_client, sku_id

VERCEL = "https://chibirex-dashboard.vercel.app"


def _event(path: str, origin: str = VERCEL) -> dict:
    return {
        "version": "2.0", "routeKey": "$default", "rawPath": path, "rawQueryString": "",
        "headers": {"host": "uji.lambda-url.ap-southeast-2.on.aws", "origin": origin},
        "requestContext": {"http": {"method": "GET", "path": path, "protocol": "HTTP/1.1", "sourceIp": "127.0.0.1",
                                    "userAgent": "uji"},
                           "domainName": "uji.lambda-url.ap-southeast-2.on.aws", "stage": "$default",
                           "requestId": "uji", "accountId": "anonymous", "apiId": "uji"},
        "isBase64Encoded": False,
    }


def test_pengaturan_di_lambda(monkeypatch):
    monkeypatch.setenv("AWS_LAMBDA_FUNCTION_NAME", "chibirex-api-function")
    for env in ("CHIBIREX_STATE_DB", "CHIBIREX_SAP_MOCK_DB", "CHIBIREX_SAP_URL"):
        monkeypatch.delenv(env, raising=False)
    s = Settings()
    assert (s.state_db, s.sap_mock_db) == (Path("/tmp/state.sqlite"), Path("/tmp/sap_mock.sqlite"))
    assert s.sap_dalam_proses and not s.agent_lokal

    monkeypatch.delenv("AWS_LAMBDA_FUNCTION_NAME")
    lokal = Settings()
    assert lokal.state_db.parts[-3:] == ("data", "processed", "state.sqlite")
    assert not lokal.sap_dalam_proses and lokal.agent_lokal


def test_approve_dengan_tiruan_sap_di_proses_yang_sama(analytics_db, tmp_path):
    # Tanpa server di 127.0.0.1 (seperti di Lambda), approve tetap membuat PO lewat alur OData + CSRF.
    with buat_client(analytics_db, tmp_path, sap_client=None, sap_dalam_proses=True) as client:
        po = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "Penjualan naik, stok menipis"},
                         headers={"Idempotency-Key": "lambda-po-0001"}).json()
        assert "di proses API yang sama" in client.get(f"/purchase-orders/{po['po_id']}/sap-payload").json()["tujuan"]
        disetujui = client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": "manajer"}).json()
        assert disetujui["status"] == "APPROVED" and disetujui["sap_po_number"] == "4500000001"


def test_handler_mangum_dan_cors_dashboard(analytics_db, tmp_path):
    app = create_app(Settings(analytics_db=analytics_db, state_db=tmp_path / "state.sqlite",
                              sap_mock_db=tmp_path / "sap.sqlite"))
    siapkan(app)
    siapkan(app)  # idempoten: koneksi DuckDB tidak dibuka dua kali
    try:
        handler = Mangum(app, lifespan="off")
        r = handler(_event("/stores"), None)
        assert r["statusCode"] == 200 and json.loads(r["body"])[0]["store"] == 1
        assert r["headers"]["access-control-allow-origin"] == VERCEL

        preview = "https://chibirex-dashboard-git-fitur-tim.vercel.app"
        assert handler(_event("/health", preview), None)["headers"]["access-control-allow-origin"] == preview
        asing = handler(_event("/health", "https://situs-lain.vercel.app"), None)["headers"]
        assert "access-control-allow-origin" not in asing
    finally:
        tutup(app)
