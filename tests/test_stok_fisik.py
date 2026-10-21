"""Uji skenario selisih stok: hitung fisik menurunkan Data Confidence, lalu guardrail menahan PO sampai diaudit."""

from tests.api_data import sku_id

MANAJER = "manajer toko"


def _catat(client, brand: int, stok_fisik: int):
    return client.post(f"/sku/{sku_id(brand)}/stok-fisik",
                       json={"stok_fisik": stok_fisik, "dicatat_oleh": MANAJER, "catatan": "stock opname (simulasi)"})


def _po(client, brand: int, kunci: str):
    return client.post("/purchase-orders", json={"inventory_id": sku_id(brand), "alasan": "Penjualan naik, stok menipis"},
                       headers={"Idempotency-Key": kunci})


def test_selisih_besar_menurunkan_confidence_dan_menahan_po(client):
    r = _catat(client, 10, 37)  # stok sistem 50, fisik 37: selisih 26%
    assert r.status_code == 201
    hasil = r.json()
    assert (hasil["selisih"], hasil["data_confidence_data"], hasil["data_confidence"], hasil["perlu_audit"]) == \
        (-13, 1.0, 0.74, True)

    sku = client.get(f"/sku/{sku_id(10)}").json()
    assert (sku["data_confidence"], sku["stok_fisik"]) == (0.74, 37)
    assert [s["stok_fisik"] for s in client.get("/sku", params={"store": 1}).json()
            if s["inventory_id"] == sku_id(10)] == [37]

    po = _po(client, 10, "selisih-0001").json()
    assert po["status"] == "DITAHAN_GUARDRAIL"
    assert [p["kode"] for p in po["pelanggaran"]] == ["DATA_CONFIDENCE_RENDAH"]
    assert [c["inventory_id"] for c in client.get("/stores/1/stok-fisik").json()] == [sku_id(10)]


def test_selisih_kecil_tidak_menahan_po(client):
    assert _catat(client, 10, 48).json()["data_confidence"] == 0.96
    assert _po(client, 10, "selisih-0002").json()["status"] == "DRAFT"


def test_draf_lama_tidak_bisa_disetujui_sampai_audit_selesai(client):
    po = _po(client, 10, "selisih-0003").json()
    assert po["status"] == "DRAFT"
    _catat(client, 10, 30)

    ditolak = client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": MANAJER})
    assert ditolak.status_code == 409 and ditolak.json()["detail"]["kode"] == "DATA_CONFIDENCE_RENDAH"
    assert client.get(f"/purchase-orders/{po['po_id']}").json()["status"] == "DRAFT"

    assert client.delete(f"/sku/{sku_id(10)}/stok-fisik", params={"oleh": MANAJER}).status_code == 204
    assert client.get(f"/sku/{sku_id(10)}").json()["data_confidence"] == 1.0
    disetujui = client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": MANAJER}).json()
    assert disetujui["status"] == "APPROVED" and disetujui["sap_po_number"]

    aksi = [a["aksi"] for a in client.get("/audit-log").json()]
    assert aksi[:3] == ["po_approved", "audit_stok_selesai", "catat_stok_fisik"]


def test_hold_juga_ditahan_saat_selisih_belum_diaudit(client):
    _catat(client, 20, 10)
    r = client.post("/holds", json={"inventory_id": sku_id(20), "alasan": "Penjualan turun, tidak komplementer"},
                    headers={"Idempotency-Key": "selisih-hold-1"})
    assert r.status_code == 422
    assert "DATA_CONFIDENCE_RENDAH" in {p["kode"] for p in r.json()["detail"]["pelanggaran"]}


def test_audit_tanpa_catatan(client):
    r = client.delete(f"/sku/{sku_id(10)}/stok-fisik", params={"oleh": MANAJER})
    assert r.status_code == 404 and r.json()["detail"]["kode"] == "STOK_FISIK_TIDAK_ADA"
