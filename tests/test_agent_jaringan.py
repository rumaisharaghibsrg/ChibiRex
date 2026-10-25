"""Uji agent jaringan (copilot/jaringan.py) tanpa jaringan: Bedrock Converse dan API Rexa diganti tiruan."""

import json

from copilot import jaringan, lambda_handler
from tests.test_copilot import event, respons


def toko(store, kota, health, reorder):
    return {"store": store, "kota": kota, "health_score": health, "ketersediaan": 80.0, "perputaran": 70.0,
            "stabilitas_kas": 60.0, "sku_aktif": 1000, "perlu_reorder": reorder, "overstock": 50, "deadstock": 5,
            "sku_risiko_tinggi": 10, "nilai_stok_idr": 1e9, "modal_tertahan_idr": 2e8, "po_menunggu": 0,
            "nilai_po_menunggu_idr": 0, "hold_aktif": 0, "modal_diselamatkan_idr": 0}


RINGKASAN = {"per_tanggal": "2017-01-07", "hari_ke": 7, "jumlah_toko": 3, "health_rata": 63.0, "nilai_stok_idr": 3e9,
             "modal_tertahan_idr": 6e8, "perlu_reorder": 900, "sku_risiko_tinggi": 30, "po_menunggu": 0,
             "nilai_po_menunggu_idr": 0, "modal_diselamatkan_idr": 0,
             "toko": [toko(1, "HARDERSFIELD", 75, 100), toko(26, "KNIFE'S EDGE", 52, 600), toko(81, "PEMBROKE", 53, 200)]}
TRANSFER = {"per_tanggal": "2017-01-07", "total_nilai_idr": 115906080, "transfer": [
    {"merek": 1, "deskripsi": "Moet & Chandon Nectar Imp Rs", "dari_toko": 66, "dari_kota": "A",
     "dari_inventory_id": "66_A_1", "status_dari": "OVERSTOCK", "kelebihan_unit": 213, "ke_toko": 26,
     "ke_kota": "KNIFE'S EDGE", "ke_inventory_id": "26_K_1", "qty": 213, "nilai_idr": 115906080}]}


class ApiTiruan:
    def __init__(self):
        self.url = []

    def __call__(self, url: str):
        self.url.append(url)
        if url.endswith("/jaringan/ringkasan"):
            return RINGKASAN
        if "/jaringan/transfer" in url:
            return TRANSFER
        if url.endswith("/stores/26/ringkasan"):
            return {"store": 26, "kota": "KNIFE'S EDGE", "health_score": 52, "po_menunggu": 0,
                    "komponen": [{"nama": "Ketersediaan stok", "nilai": 40.0}]}
        if "/stores/26/prioritas" in url:
            return {"naik": [{"inventory_id": "26_K_1", "deskripsi": "Moet", "saran_qty_po": 213}], "turun": []}
        raise AssertionError(f"URL tak terduga: {url}")


def tool(nama, masukan, uid="t1"):
    r = respons(tool=(nama, masukan))
    r["output"]["message"]["content"][0]["toolUse"]["toolUseId"] = uid
    return r


PRIORITAS = {"ringkasan": "Dua toko di bawah 65.", "toko": [
    {"store": 26, "alasan": "Health 52, 600 SKU perlu reorder.", "tindakan": "Buka toko 26 lalu Jalankan Agent."}],
    "transfer": [{"ke_inventory_id": "26_K_1", "alasan": "Menghindari PO Rp 115,9 juta."}]}


def jalankan(antrian, api=None):
    panggilan = []

    def converse(**kw):
        panggilan.append(json.loads(json.dumps(kw)))
        return antrian.pop(0)

    api = api or ApiTiruan()
    hasil = jaringan.analisis(data=jaringan.DataJaringan("http://api", api), converse=converse)
    return hasil, panggilan, api


def test_analisis_sampai_prioritas():
    hasil, panggilan, api = jalankan([
        tool("ringkasan_jaringan", {"urut": "health_score", "limit": 2}), tool("detail_toko", {"store": 26}),
        tool("peluang_transfer", {"limit": 5}), tool("tetapkan_prioritas", PRIORITAS)])
    assert [l["alat"] for l in hasil["langkah"]] == ["ringkasan_jaringan", "detail_toko", "peluang_transfer",
                                                      "tetapkan_prioritas"]
    # Toko dan transfer dilengkapi angka dari API, bukan dari model.
    assert hasil["toko"] == [{**{k: RINGKASAN["toko"][1][k] for k in jaringan.FIELD_TOKO},
                              "alasan": "Health 52, 600 SKU perlu reorder.", "tindakan": "Buka toko 26 lalu Jalankan Agent."}]
    assert hasil["transfer"][0]["dari_toko"] == 66 and hasil["transfer"][0]["qty"] == 213
    assert (hasil["per_tanggal"], hasil["model"], hasil["token_input"]) == ("2017-01-07", jaringan.MODEL_ID, 400)

    # ringkasan_jaringan urut health terendah dulu; total jaringan ada di prompt sistem.
    hasil_tool = panggilan[1]["messages"][-1]["content"][0]["toolResult"]["content"][0]["json"]
    assert [t["store"] for t in hasil_tool["toko"]] == [26, 81]
    assert '"health_rata": 63.0' in panggilan[0]["system"][0]["text"]
    assert '"toko_merah_di_bawah_65": 2' in panggilan[0]["system"][0]["text"]  # toko 26 dan 81
    # detail_toko memuat transfer yang melibatkan toko itu, beserta arahnya.
    detail = panggilan[2]["messages"][-1]["content"][0]["toolResult"]["content"][0]["json"]
    assert detail["transfer_masuk"] == [{"terima_dari_toko": 66, "deskripsi": "Moet & Chandon Nectar Imp Rs", "qty": 213,
                                          "nilai_idr": 115906080}] and detail["transfer_keluar"] == []
    assert sum(u.endswith("/jaringan/ringkasan") for u in api.url) == 1  # dibaca sekali per analisis


def test_toko_karangan_dikembalikan_ke_model():
    salah = {**PRIORITAS, "toko": [{"store": 999, "alasan": "x", "tindakan": "y"}]}
    hasil, panggilan, _ = jalankan([tool("tetapkan_prioritas", salah), tool("tetapkan_prioritas", PRIORITAS, "t2")])
    galat = panggilan[1]["messages"][-1]["content"][0]["toolResult"]["content"][0]["json"]["error"]
    assert "999" in galat and [t["store"] for t in hasil["toko"]] == [26]


def test_batas_detail_toko():
    data = jaringan.DataJaringan("http://api", ApiTiruan())
    hasil = [data.jalankan("detail_toko", {"store": 26}) for _ in range(jaringan.MAKS_DETAIL + 1)]
    assert "naik" in hasil[0] and "Batas" in hasil[-1]["error"]
    assert data.jalankan("detail_toko", {"store": 5})["error"] == "Toko 5 tidak ada di jaringan."
    assert data.jalankan("draft_purchase_order", {}) == {"error": "Tool draft_purchase_order tidak dikenal"}


def test_model_berhenti_tanpa_prioritas_dipaksa_melapor():
    hasil, panggilan, _ = jalankan([respons("Sekarang saya tetapkan prioritas:"), tool("tetapkan_prioritas", PRIORITAS)])
    assert "toolChoice" not in panggilan[0]["toolConfig"]
    assert panggilan[1]["toolConfig"]["toolChoice"] == {"tool": {"name": "tetapkan_prioritas"}}
    assert [t["store"] for t in hasil["toko"]] == [26]

    # Kalau tetap tanpa laporan, teksnya ditampilkan tanpa daftar toko.
    hasil, _, _ = jalankan([respons("Semua toko baik."), respons("Semua toko baik-baik saja.")])
    assert (hasil["ringkasan"], hasil["toko"], hasil["transfer"]) == ("Semua toko baik-baik saja.", [], [])


def test_putaran_terakhir_dipaksa_melapor():
    antrian = [tool("ringkasan_jaringan", {}, f"t{i}") for i in range(jaringan.MAKS_PUTARAN - 1)]
    hasil, panggilan, _ = jalankan(antrian + [tool("tetapkan_prioritas", PRIORITAS)])
    assert "toolChoice" in panggilan[-1]["toolConfig"] and "toolChoice" not in panggilan[-2]["toolConfig"]
    assert [t["store"] for t in hasil["toko"]] == [26]


def test_handler_jaringan(monkeypatch):
    salah = lambda_handler.handler(event(body={"bahasa": "fr"}, path="/jaringan"), None)
    assert salah["statusCode"] == 422

    monkeypatch.setattr(jaringan, "analisis", lambda bahasa: {"ringkasan": f"ok {bahasa}"})
    ok = lambda_handler.handler(event(body={"bahasa": "en"}, path="/jaringan"), None)
    assert ok["statusCode"] == 200 and json.loads(ok["body"]) == {"ringkasan": "ok en"}

    def gagal(bahasa):
        raise RuntimeError("Bedrock mati")

    monkeypatch.setattr(jaringan, "analisis", gagal)
    r = lambda_handler.handler(event(body={}, path="/jaringan"), None)
    assert r["statusCode"] == 502 and "Bedrock" not in r["body"]
