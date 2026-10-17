"""Uji tiruan SAP (OData V2 API_PURCHASEORDER_PROCESS_SRV) dan alur 1-Click Approval → PO di SAP."""

import sqlite3

import httpx
import pytest
from fastapi.testclient import TestClient

from api import sap, state
from sap_mock import SERVICE
from sap_mock.app import create_sap_mock
from tests.api_data import SEKARANG, buat_client, sku_id


@pytest.fixture
def sap_client(tmp_path):
    return TestClient(create_sap_mock(tmp_path / "sap.sqlite"), base_url="http://testserver" + SERVICE)


def payload(**ubah) -> dict:
    po = {"inventory_id": "74_PAENTMARWY_4222", "store": 74, "vendor_number": 1128, "qty": 107,
          "harga_beli_usd": 7.99, **ubah}
    return sap.payload_po(po, SEKARANG)


def test_post_tanpa_token_csrf_ditolak(sap_client):
    r = sap_client.post("/A_PurchaseOrder", json=payload())
    assert r.status_code == 403
    assert r.headers["x-csrf-token"] == "Required"


def test_buat_dan_baca_po(sap_client):
    pertama = sap.kirim_po(sap_client, payload())
    kedua = sap.kirim_po(sap_client, payload(qty=5))
    assert (pertama["PurchaseOrder"], kedua["PurchaseOrder"]) == ("4500000001", "4500000002")
    assert pertama["__metadata"]["type"] == "API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType"

    d = sap_client.get("/A_PurchaseOrder('4500000001')").json()["d"]
    item = d["to_PurchaseOrderItem"]["results"][0]
    assert (d["PurchaseOrderType"], d["Supplier"], d["DocumentCurrency"]) == ("NB", "1128", "IDR")
    assert (item["Plant"], item["Material"], item["OrderQuantity"]) == ("T074", "BIB-4222", "107")
    assert item["to_PurchaseOrderPricingElement"]["results"][0]["ConditionRateValue"] == str(round(7.99 * 16_000))
    assert len(sap_client.get("/A_PurchaseOrder").json()["d"]["results"]) == 2
    assert sap_client.get("/A_PurchaseOrder('4599999999')").status_code == 404


def test_field_wajib_divalidasi(sap_client):
    p = payload()
    del p["Supplier"]
    with pytest.raises(sap.SapError, match="Supplier"):
        sap.kirim_po(sap_client, p)


def test_approve_mengirim_po_ke_sap(client):
    po_id = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "Penjualan naik"},
                        headers={"Idempotency-Key": "kunci-sap-01"}).json()["po_id"]
    pratinjau = client.get(f"/purchase-orders/{po_id}/sap-payload").json()
    assert pratinjau["payload"]["to_PurchaseOrderItem"]["results"][0]["OrderQuantity"] == "70"

    po = client.post(f"/purchase-orders/{po_id}/approve", json={"oleh": "manajer"}).json()
    assert po["status"] == "APPROVED"
    assert po["sap_po_number"] == "4500000001"

    # PO bisa dibaca dari tiruan SAP yang ter-mount di /sap.
    d = client.get(f"/sap{SERVICE}/A_PurchaseOrder('4500000001')").json()["d"]
    item = d["to_PurchaseOrderItem"]["results"][0]
    assert (item["Material"], item["Plant"], item["OrderQuantity"]) == ("BIB-10", "T001", "70")
    assert client.get("/audit-log").json()[0]["detail"]["sap_po_number"] == "4500000001"


def test_sap_gagal_po_tetap_draft(analytics_db, tmp_path):
    sap_mati = lambda: httpx.Client(base_url="http://127.0.0.1:9" + SERVICE, timeout=1)  # noqa: E731
    with buat_client(analytics_db, tmp_path, sap_client=sap_mati) as client:
        po_id = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "Penjualan naik"},
                            headers={"Idempotency-Key": "kunci-sap-02"}).json()["po_id"]
        r = client.post(f"/purchase-orders/{po_id}/approve", json={"oleh": "manajer"})
        assert r.status_code == 502
        assert r.json()["detail"]["kode"] == "SAP_GAGAL"
        po = client.get(f"/purchase-orders/{po_id}").json()
        assert (po["status"], po["sap_po_number"]) == ("DRAFT", None)


def test_reject_tidak_mengirim_ke_sap(client):
    po_id = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "Penjualan naik"},
                        headers={"Idempotency-Key": "kunci-sap-03"}).json()["po_id"]
    po = client.post(f"/purchase-orders/{po_id}/reject", json={"oleh": "manajer", "catatan": "tunda"}).json()
    assert (po["status"], po["sap_po_number"]) == ("REJECTED", None)
    assert client.get(f"/sap{SERVICE}/A_PurchaseOrder").json()["d"]["results"] == []


def test_migrasi_database_lama(tmp_path):
    db = tmp_path / "lama.sqlite"
    con = sqlite3.connect(db)
    con.execute("create table purchase_orders (po_id text primary key, status text)")  # skema sebelum Tahap 6
    con.close()
    state.init(db)
    con = sqlite3.connect(db)
    kolom = {r[1] for r in con.execute("pragma table_info(purchase_orders)")}
    con.close()
    assert {"sap_po_number", "sap_dikirim_pada"} <= kolom
