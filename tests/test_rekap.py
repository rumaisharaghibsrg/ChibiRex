"""Uji rekap agent per hari simulasi (GET /stores/{store}/rekap)."""

from tests.api_data import buat_client, sku_id


def test_rekap_per_hari_simulasi(analytics_db, tmp_path):
    with buat_client(analytics_db, tmp_path) as client:
        # Hari 0: agent menyimpan jejak, menahan reorder Ciroc, dan menyusun draf PO Bacardi.
        jejak = {"run_id": "run-rekap-001", "tugas": "Tinjau toko 1", "store": 1, "model": "uji",
                 "jawaban": "Ringkasan hari 0", "durasi_dtk": 20.0, "token_input": 1000, "token_output": 100,
                 "langkah": [{"tool": "list_prioritas", "input": {}, "output": None, "detik": 0.1}], "berhasil": True}
        assert client.post("/agent-runs", json=jejak).status_code == 201
        hold = client.post("/holds", json={"inventory_id": sku_id(20), "alasan": "Vs turun dan tidak komplementer"},
                           headers={"Idempotency-Key": "rekap-hold-0001"}).json()
        po = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "Penjualan naik, stok menipis"},
                         headers={"Idempotency-Key": "rekap-po-00001"}).json()
        # Hari 2: manajer menyetujui PO tersebut.
        client.post("/simulasi/maju", json={"hari": 2})
        client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": "manajer"})

        r = client.get("/stores/1/rekap").json()
        assert [h["hari_ke"] for h in r["hari"]] == [2, 0]  # terbaru dulu
        hari2, hari0 = r["hari"]
        assert hari2["tanggal"] == "2017-01-02"
        assert [(p["po_id"], p["sap_po_number"]) for p in hari2["po_disetujui"]] == [(po["po_id"], "4500000001")]
        assert hari2["run"] == [] and hari2["po_dibuat"] == []
        assert [(x["run_id"], x["jumlah_langkah"], x["ringkasan"]) for x in hari0["run"]] == [
            ("run-rekap-001", 1, "Ringkasan hari 0")]
        assert hari0["hold"][0]["hold_id"] == hold["hold_id"]
        assert hari0["modal_diselamatkan_idr"] == hold["modal_diselamatkan_idr"]
        assert hari0["po_dibuat"][0]["status"] == "APPROVED" and hari0["nilai_draf_idr"] == po["nilai_idr"]
        t = r["total"]
        assert (t["run"], t["hold"], t["po_dibuat"], t["po_disetujui"], t["po_ditolak"], t["token_input"]) == (
            1, 1, 1, 1, 0, 1000)

        kosong = client.get("/stores/2/rekap").json()
        assert kosong["hari"] == [] and kosong["total"]["run"] == 0
