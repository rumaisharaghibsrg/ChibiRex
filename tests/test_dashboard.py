"""Uji endpoint untuk dashboard: CORS, daftar toko, ringkasan + Health Score, dan menjalankan agent di latar."""

import threading
import time

from tests.api_data import buat_client, sku_id

KEPUTUSAN = {"oleh": "manajer toko"}


def _kunci(nama: str) -> dict:
    return {"Idempotency-Key": f"uji-dashboard-{nama}"}


def test_cors_mengizinkan_dashboard_lokal(client):
    r = client.options("/stores", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    r = client.options("/stores", headers={"Origin": "http://situs-lain.test", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in r.headers


def test_daftar_toko(client):
    toko = client.get("/stores").json()
    assert [t["store"] for t in toko] == [1]
    assert toko[0]["sku_aktif"] > 0 and toko[0]["perlu_reorder"] > 0


def test_ringkasan_health_score_dan_kpi_dari_tindakan(client):
    awal = client.get("/stores/1/ringkasan").json()
    assert 0 <= awal["health_score"] <= 100
    assert [k["kode"] for k in awal["komponen"]] == ["KETERSEDIAAN", "PERPUTARAN", "STABILITAS_KAS"]
    assert awal["health_score"] == round(sum(k["nilai"] for k in awal["komponen"]) / 3)
    assert awal["po_menunggu"] == 0 and awal["modal_diselamatkan_idr"] == 0

    po = client.post("/purchase-orders", json={"inventory_id": sku_id(10), "alasan": "Penjualan naik, stok menipis"},
                     headers=_kunci("po")).json()
    client.post("/holds", json={"inventory_id": sku_id(20), "alasan": "Penjualan turun, tidak komplementer"},
                headers=_kunci("hold"))
    sesudah = client.get("/stores/1/ringkasan").json()
    assert sesudah["po_menunggu"] == 1 and sesudah["nilai_po_menunggu_idr"] == po["nilai_idr"]
    assert sesudah["modal_diselamatkan_idr"] > 0 and sesudah["exploration_budget_idr"] > 0

    client.post(f"/purchase-orders/{po['po_id']}/approve", json=KEPUTUSAN)
    akhir = client.get("/stores/1/ringkasan").json()
    assert (akhir["po_menunggu"], akhir["po_disetujui"]) == (0, 1)


def test_toko_tidak_ada(client):
    assert client.get("/stores/999/ringkasan").json()["detail"]["kode"] == "TOKO_TIDAK_ADA"
    assert client.post("/agent-runs/mulai", json={"store": 999}).status_code == 404


def _tunggu(client, run_id: str, syarat) -> dict:
    for _ in range(250):
        r = client.get(f"/agent-runs/{run_id}").json()
        if syarat(r):
            return r
        time.sleep(0.02)
    raise AssertionError(f"Agent run {run_id} tidak mencapai kondisi yang ditunggu: {r}")


def test_jalankan_agent_dari_dashboard(analytics_db, tmp_path):
    lanjut = threading.Event()

    def agent_palsu(tugas, store, run_id, langkah):
        langkah.append({"tool": "list_prioritas", "input": {"store": store}, "output": {"naik": []}, "detik": 0.1})
        lanjut.wait(5)
        return {"berhasil": True}

    with buat_client(analytics_db, tmp_path, agent_runner=agent_palsu) as client:
        run = client.post("/agent-runs/mulai", json={"store": 1}).json()
        assert run["status"] == "BERJALAN" and run["tugas"].startswith("Tinjau toko 1")
        # Langkah terlihat selagi agent berjalan, dan agent kedua ditolak.
        sementara = _tunggu(client, run["run_id"], lambda r: r["langkah"])
        assert sementara["status"] == "BERJALAN"
        assert client.post("/agent-runs/mulai", json={"store": 1}).json()["detail"]["kode"] == "AGENT_SEDANG_BERJALAN"
        lanjut.set()
        selesai = _tunggu(client, run["run_id"], lambda r: r["status"] == "SELESAI")
        assert [l["tool"] for l in selesai["langkah"]] == ["list_prioritas"]
        assert client.get("/agent-runs/tidak-ada").status_code == 404


def test_agent_lokal_tidak_dijalankan_di_lambda(analytics_db, tmp_path):
    with buat_client(analytics_db, tmp_path, agent_mode="mati") as client:
        r = client.post("/agent-runs/mulai", json={"store": 1})
        assert r.status_code == 503 and r.json()["detail"]["kode"] == "AGENT_BELUM_TERSEDIA"


def test_status_agent_dari_jejak_tersimpan(analytics_db, tmp_path):
    def agent_palsu(tugas, store, run_id, langkah):
        # Agent asli menyimpan jejaknya sendiri lewat POST /agent-runs di akhir.
        jejak.update(run_id=run_id, tugas=tugas, store=store)
        return {"berhasil": False, "jawaban": "Agent gagal: Ollama tidak berjalan"}

    jejak = {}
    with buat_client(analytics_db, tmp_path, agent_runner=agent_palsu) as client:
        run = client.post("/agent-runs/mulai", json={"store": 1, "tugas": "Tinjau toko 1"}).json()
        gagal = _tunggu(client, run["run_id"], lambda r: r["status"] == "GAGAL")
        assert gagal["pesan"] == "Agent gagal: Ollama tidak berjalan"

        client.post("/agent-runs", json={**jejak, "model": "uji", "jawaban": "Ringkasan", "durasi_dtk": 1.0,
                                         "token_input": 10, "token_output": 5, "berhasil": True,
                                         "langkah": [{"tool": "list_prioritas", "input": {}, "output": None,
                                                      "detik": 0.1}]})
        tersimpan = client.get(f"/agent-runs/{run['run_id']}").json()
        assert (tersimpan["status"], tersimpan["jawaban"], tersimpan["model"]) == ("SELESAI", "Ringkasan", "uji")
