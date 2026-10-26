"""Uji tools API dan guardrail dengan database analitik sintetis yang skenarionya terkontrol."""

import pytest

from tests.api_data import KURS, buat_client, sku_id


def draft(client, brand, kunci, **body):
    payload = {"inventory_id": sku_id(brand), "alasan": "Vs naik dan stok di bawah reorder point", **body}
    return client.post("/purchase-orders", json=payload, headers={"Idempotency-Key": kunci})


def hold(client, brand, kunci):
    payload = {"inventory_id": sku_id(brand), "alasan": "Vs turun dan tidak komplementer"}
    return client.post("/holds", json=payload, headers={"Idempotency-Key": kunci})


def kode(resp) -> set[str]:
    return {p["kode"] for p in resp.json()["pelanggaran"]}


# ------------------------------------------------------------------ tools baca

def test_get_sku_metrics(client):
    r = client.get(f"/sku/{sku_id(10)}")
    assert r.status_code == 200
    assert r.json()["jenis"] == "rum"
    assert r.json()["saran_qty_po"] == 70
    assert client.get("/sku/1_KOTA_999").status_code == 404
    assert client.get("/sku/bukan-id").status_code == 422


def test_list_sku_filter_status(client):
    r = client.get("/sku", params={"store": 1, "status_stok": "AMAN"})
    assert [s["inventory_id"] for s in r.json()] == [sku_id(50)]


def test_check_substitution(client):
    r = client.get(f"/sku/{sku_id(10)}/substitution").json()
    assert r["status"] == "KOMPLEMENTER"
    assert r["mitra"][0]["jenis"] == "gin"
    r = client.get(f"/sku/{sku_id(20)}/substitution").json()
    assert r["status"] == "TIDAK_KOMPLEMENTER"
    assert r["mitra"] == []  # vodka -> gin 1,46x di bawah ambang 1,5x


# ------------------------------------------------------------------ draf PO & guardrail

def test_draft_po_default_berstatus_draft(client):
    r = draft(client, 10, "kunci-0001")
    assert r.status_code == 201
    po = r.json()
    assert po["status"] == "DRAFT"
    assert po["qty"] == 70
    assert po["nilai_idr"] == 70 * 10 * KURS
    assert po["pelanggaran"] == []


def test_idempotency_key(client):
    pertama = draft(client, 10, "kunci-0002")
    ulang = draft(client, 10, "kunci-0002")
    assert ulang.status_code == 200
    assert ulang.headers["Idempotent-Replay"] == "true"
    assert ulang.json()["po_id"] == pertama.json()["po_id"]
    assert len(client.get("/purchase-orders").json()) == 1
    assert draft(client, 10, "kunci-0002", qty=5).status_code == 409  # kunci sama, isi berbeda
    resp = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "tanpa kunci idempotency"})
    assert resp.status_code == 422


def test_field_tambahan_ditolak(client):
    r = draft(client, 10, "kunci-0003", status="APPROVED")
    assert r.status_code == 422


def test_outlier_3sigma(client):
    # batas wajar = ceil(120 + 3 * 4 * sqrt(8 + 14) - 50) = 127
    assert draft(client, 10, "kunci-0004", qty=127).json()["status"] == "DRAFT"
    r = draft(client, 20, "kunci-0005", qty=128)
    assert r.json()["status"] == "DITAHAN_GUARDRAIL"
    assert kode(r) == {"OUTLIER_3SIGMA"}


def test_data_confidence_rendah(client):
    r = draft(client, 40, "kunci-0006")
    assert r.json()["status"] == "DITAHAN_GUARDRAIL"
    assert "DATA_CONFIDENCE_RENDAH" in kode(r)


def test_batas_po_harian(analytics_db, tmp_path):
    with buat_client(analytics_db, tmp_path, batas_po_harian_idr=20_000_000) as client:
        assert draft(client, 10, "kunci-0007").json()["status"] == "DRAFT"  # Rp11,2 juta
        r = draft(client, 20, "kunci-0008")  # + Rp22,4 juta
        assert r.json()["status"] == "DITAHAN_GUARDRAIL"
        assert kode(r) == {"BATAS_HARIAN"}
        assert client.get("/guardrails/status", params={"store": 1}).json()["total_po_hari_ini_idr"] == 70 * 10 * KURS

        # Batas harian mengikuti hari simulasi (bukan tanggal kalender): hari berikutnya anggarannya terbuka lagi,
        # dan kembali ke hari itu menghitung PO hari itu lagi.
        client.post("/simulasi/maju", json={"hari": 1, "oleh": "uji"})
        assert client.get("/guardrails/status", params={"store": 1}).json()["total_po_hari_ini_idr"] == 0
        client.post("/simulasi/mundur", json={"hari": 1, "oleh": "uji"})
        assert client.get("/guardrails/status", params={"store": 1}).json()["total_po_hari_ini_idr"] == 70 * 10 * KURS


def test_circuit_breaker(client):
    for i in range(3):
        assert draft(client, 10, f"outlier-{i:04d}", qty=500).json()["status"] == "DITAHAN_GUARDRAIL"
    assert client.get("/guardrails/status").json()["circuit_breaker_terbuka"] is True

    r = draft(client, 20, "normal-0001")
    assert r.json()["status"] == "DITAHAN_GUARDRAIL"
    assert kode(r) == {"CIRCUIT_BREAKER"}

    client.post("/guardrails/circuit-breaker/reset", json={"oleh": "manajer", "catatan": "sudah dicek"})
    assert draft(client, 20, "normal-0002").json()["status"] == "DRAFT"


def test_approval_hanya_untuk_draft(client):
    po_id = draft(client, 10, "kunci-0009").json()["po_id"]
    r = client.post(f"/purchase-orders/{po_id}/approve", json={"oleh": "manajer"})
    assert r.json()["status"] == "APPROVED"
    assert r.json()["diputuskan_oleh"] == "manajer"
    assert client.post(f"/purchase-orders/{po_id}/approve", json={"oleh": "manajer"}).status_code == 409

    ditahan = draft(client, 40, "kunci-0010").json()["po_id"]
    assert client.post(f"/purchase-orders/{ditahan}/approve", json={"oleh": "manajer"}).status_code == 409


# ------------------------------------------------------------------ hold & realokasi

def test_hold_reorder_dengan_exploration_budget(client):
    r = hold(client, 20, "hold-0001")
    assert r.status_code == 201
    h = r.json()
    assert h["qty_ditahan"] == 70
    assert h["qty_uji"] == 7  # 10% tetap dibeli sebagai stok uji
    assert h["modal_ditahan_idr"] == 70 * 20 * KURS
    assert h["modal_diselamatkan_idr"] == (70 - 7) * 20 * KURS
    assert h["review_pada"] == "2017-03-31"

    lagi = hold(client, 20, "hold-0002")  # kunci baru, SKU sama: tidak membuat hold ganda
    assert lagi.status_code == 200
    assert lagi.json()["hold_id"] == h["hold_id"]


@pytest.mark.parametrize("brand, kode_wajib", [
    (30, {"PUNYA_PERAN_KOMPLEMENTER"}),
    (40, {"DATA_CONFIDENCE_RENDAH"}),
    (50, {"TIDAK_PERLU_REORDER"}),
    (60, {"JENIS_TIDAK_DIKETAHUI"}),
    (80, {"TREN_TIDAK_ANDAL"}),
    (10, {"VS_TIDAK_TURUN", "PUNYA_PERAN_KOMPLEMENTER"}),
])
def test_hold_ditolak(client, brand, kode_wajib):
    r = hold(client, brand, f"tolak-{brand:04d}")
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["kode"] == "HOLD_DITOLAK"
    assert kode_wajib <= {p["kode"] for p in detail["pelanggaran"]}
    assert client.get("/audit-log").json()[0]["aksi"] == "hold_reorder_ditolak"


def test_suggest_reallocation(client):
    kosong = client.get("/stores/1/reallocation").json()
    assert kosong["dana_tersedia_idr"] == 0

    hold(client, 20, "hold-0003")
    r = client.get("/stores/1/reallocation").json()
    dana = (70 - 7) * 20 * KURS
    assert r["dana_tersedia_idr"] == dana
    # SKU 70 naik 50x tetapi basisnya hanya 12 unit, jadi tidak ikut dialokasikan dana.
    assert [t["inventory_id"] for t in r["tujuan"]] == [sku_id(10)]
    assert r["tujuan"][0]["dialokasikan_idr"] == 70 * 10 * KURS
    assert r["sisa_dana_idr"] == dana - 70 * 10 * KURS
    assert "Ciroc Apple Vodka" in r["pesan"] and "Bacardi Gold Rum" in r["pesan"]


def test_audit_log_mencatat_aksi(client):
    draft(client, 10, "kunci-0011")
    hold(client, 20, "hold-0004")
    aksi = [a["aksi"] for a in client.get("/audit-log").json()]
    assert aksi == ["hold_reorder", "draft_purchase_order"]


def test_arah_tren(client):
    arah = {b: client.get(f"/sku/{sku_id(b)}").json()["arah_tren"] for b in (10, 20, 70)}
    assert arah == {10: "NAIK", 20: "TURUN", 70: "TIDAK_ANDAL"}  # 70: basis Jan–Sep hanya 12 unit


def test_list_prioritas(client):
    r = client.get("/stores/1/prioritas").json()
    assert [s["inventory_id"] for s in r["naik"]] == [sku_id(10)]  # 70 naik 50x tapi basisnya kecil
    turun = [s["inventory_id"] for s in r["turun"]]
    assert turun[0] == sku_id(20)  # nilai PO terbesar
    assert set(turun) == {sku_id(20), sku_id(30), sku_id(60)}  # 40: confidence rendah, 50: tidak perlu reorder
    assert all(s["arah_tren"] == "TURUN" for s in r["turun"])


def test_agent_runs(client):
    run = {"run_id": "run-00000001", "tugas": "Tinjau toko 1", "store": 1, "model": "uji", "jawaban": "Selesai.",
           "langkah": [{"tool": "list_prioritas", "input": {"store": 1}, "output": {"naik": []}, "detik": 0.1}],
           "durasi_dtk": 1.5, "token_input": 100, "token_output": 20, "berhasil": True}
    assert client.post("/agent-runs", json=run).status_code == 201
    simpan = client.get("/agent-runs").json()
    assert simpan[0]["run_id"] == "run-00000001"
    assert simpan[0]["langkah"][0]["tool"] == "list_prioritas"


def test_satu_draf_per_sku(client):
    pertama = draft(client, 10, "sesi1-0001").json()
    kedua = draft(client, 10, "sesi2-0001")  # sesi lain, kunci lain
    assert kedua.status_code == 200
    assert kedua.headers["Existing-Draft"] == "true"
    assert kedua.json()["po_id"] == pertama["po_id"]
    client.post(f"/purchase-orders/{pertama['po_id']}/reject", json={"oleh": "manajer"})
    assert draft(client, 10, "sesi3-0001").json()["po_id"] != pertama["po_id"]  # setelah diputuskan, boleh lagi


def test_tidak_pesan_ulang_selagi_barang_di_jalan(client):
    po = draft(client, 10, "jalan-0001").json()
    client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": "manajer"})
    sku = client.get(f"/sku/{sku_id(10)}").json()
    # Stok gudang belum berubah, tetapi posisi stok (gudang + dalam pengiriman) sudah di atas reorder point.
    assert (sku["stok_akhir"], sku["stok_dalam_pengiriman"], sku["perlu_reorder"]) == (50, 70, False)
    ulang = draft(client, 10, "jalan-0002")
    assert ulang.status_code == 422 and ulang.json()["detail"]["kode"] == "TIDAK_PERLU_REORDER"
