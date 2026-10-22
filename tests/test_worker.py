"""Uji mode antrian: tombol dashboard -> tugas MENUNGGU -> worker di laptop mengambil, melapor langkah, menyimpan
jejak akhir. Ini jalur demo saat API di Lambda tetapi LLM (Ollama) di laptop."""

from datetime import timedelta

from tests.api_data import SEKARANG, buat_client

TOKEN = {"X-Worker-Token": "rahasia-uji"}
LANGKAH = {"tool": "list_prioritas", "input": {"store": 1}, "output": {"naik": [], "turun": []}, "detik": 0.4}


def _client(analytics_db, tmp_path, jam):
    return buat_client(analytics_db, tmp_path, agent_mode="antrian", worker_token="rahasia-uji",
                       clock=lambda: jam[0])


def test_alur_antrian_dari_tombol_sampai_selesai(analytics_db, tmp_path):
    jam = [SEKARANG]
    with _client(analytics_db, tmp_path, jam) as client:
        assert client.get("/agent-runs/worker").json() == {"mode": "antrian", "aktif": False,
                                                           "terakhir_terlihat": None, "nama": None}
        run = client.post("/agent-runs/mulai", json={"store": 1}).json()
        assert run["status"] == "MENUNGGU" and run["langkah"] == []
        assert client.post("/agent-runs/mulai", json={"store": 1}).status_code == 409

        assert client.post("/agent-runs/antrian/ambil").status_code == 401  # tanpa token
        tugas = client.post("/agent-runs/antrian/ambil", params={"nama": "laptop-uji"}, headers=TOKEN).json()
        assert (tugas["run_id"], tugas["store"]) == (run["run_id"], 1)
        assert client.post("/agent-runs/antrian/ambil", headers=TOKEN).status_code == 204
        assert client.get("/agent-runs/worker").json()["aktif"] is True

        assert client.post(f"/agent-runs/{run['run_id']}/langkah", json=LANGKAH, headers=TOKEN).status_code == 204
        sementara = client.get(f"/agent-runs/{run['run_id']}").json()
        assert sementara["status"] == "BERJALAN" and [l["tool"] for l in sementara["langkah"]] == ["list_prioritas"]
        assert client.get("/agent-runs").json() == []  # yang belum selesai tidak masuk riwayat

        jejak = {"run_id": run["run_id"], "tugas": run["tugas"], "store": 1, "model": "Ollama qwen3:14b (laptop)",
                 "jawaban": "Ringkasan agent", "langkah": [LANGKAH], "durasi_dtk": 30.0, "token_input": 900,
                 "token_output": 120, "berhasil": True}
        assert client.post("/agent-runs", json=jejak).status_code == 401  # jejak juga butuh token
        assert client.post("/agent-runs", json=jejak, headers=TOKEN).status_code == 201
        selesai = client.get(f"/agent-runs/{run['run_id']}").json()
        assert (selesai["status"], selesai["jawaban"], selesai["model"]) == \
            ("SELESAI", "Ringkasan agent", "Ollama qwen3:14b (laptop)")
        assert selesai["mulai_pada"] == SEKARANG.isoformat(timespec="seconds")
        assert [r["run_id"] for r in client.get("/agent-runs").json()] == [run["run_id"]]

        jam[0] = SEKARANG + timedelta(seconds=60)
        assert client.get("/agent-runs/worker").json()["aktif"] is False


def test_tugas_tanpa_worker_ditutup_gagal(analytics_db, tmp_path):
    jam = [SEKARANG]
    with _client(analytics_db, tmp_path, jam) as client:
        run = client.post("/agent-runs/mulai", json={"store": 1}).json()
        jam[0] = SEKARANG + timedelta(seconds=31)
        gagal = client.get(f"/agent-runs/{run['run_id']}").json()
        assert gagal["status"] == "GAGAL" and "agent.worker" in gagal["pesan"]
        assert client.post("/agent-runs/mulai", json={"store": 1}).json()["status"] == "MENUNGGU"  # bisa dicoba lagi


def test_reset_demo_mengosongkan_data_dan_sap(analytics_db, tmp_path):
    jam = [SEKARANG]
    with _client(analytics_db, tmp_path, jam) as client:
        po = client.post("/purchase-orders", json={"inventory_id": "1_KOTA_10", "alasan": "Penjualan naik, stok menipis"},
                         headers={"Idempotency-Key": "reset-uji-0001"}).json()
        assert client.post(f"/purchase-orders/{po['po_id']}/approve", json={"oleh": "manajer"}).json()["sap_po_number"] \
            == "4500000001"
        assert client.post("/demo/reset").status_code == 401
        assert client.post("/demo/reset", headers=TOKEN).status_code == 204
        assert client.get("/purchase-orders").json() == []
        assert [a["aksi"] for a in client.get("/audit-log").json()] == ["reset_demo"]

        po2 = client.post("/purchase-orders", json={"inventory_id": "1_KOTA_10", "alasan": "Penjualan naik, stok menipis"},
                          headers={"Idempotency-Key": "reset-uji-0001"}).json()  # kunci lama boleh dipakai lagi
        assert client.post(f"/purchase-orders/{po2['po_id']}/approve", json={"oleh": "manajer"}).json()["sap_po_number"] \
            == "4500000001"


def test_worker_macet_ditutup_gagal(analytics_db, tmp_path):
    jam = [SEKARANG]
    with _client(analytics_db, tmp_path, jam) as client:
        run = client.post("/agent-runs/mulai", json={"store": 1}).json()
        client.post("/agent-runs/antrian/ambil", headers=TOKEN)
        jam[0] = SEKARANG + timedelta(seconds=301)
        assert client.get(f"/agent-runs/{run['run_id']}").json()["status"] == "GAGAL"
        lapor = client.post(f"/agent-runs/{run['run_id']}/langkah", json=LANGKAH, headers=TOKEN)
        assert lapor.status_code == 409
