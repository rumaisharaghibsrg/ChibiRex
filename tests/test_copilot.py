"""Uji Rexa Copilot tanpa jaringan: Bedrock Converse dan API Rexa diganti tiruan."""

import json

from copilot import inti, lambda_handler

RINGKASAN = {"store": 74, "kota": "PAENTMARWY", "per_tanggal": "2017-01-07", "health_score": 68, "sku_aktif": 5537,
             "jumlah_status": {"REORDER": 600}, "po_menunggu": 1, "modal_diselamatkan_idr": 28555200.0,
             "komponen": [{"nama": "Ketersediaan stok", "nilai": 88.0}]}
PO = [{"po_id": "PO-1", "deskripsi": "Bacardi Gold Rum", "qty": 107, "nilai_idr": 13678880.0, "status": "DRAFT",
       "pelanggaran": [], "alasan": "Tren naik", "dibuat_oleh": "agent"}]


class ApiTiruan:
    def __init__(self):
        self.url = []

    def __call__(self, url: str):
        self.url.append(url)
        if "/ringkasan" in url:
            return RINGKASAN
        if url.endswith("/simulasi"):
            return {"hari_ke": 7, "tanggal": "2017-01-07"}
        if "/purchase-orders" in url:
            return PO
        if "/sku?" in url:
            return [{"inventory_id": "74_X_1", "deskripsi": "Bacardi Gold Rum"},
                    {"inventory_id": "74_X_2", "deskripsi": "Smirnoff 80 Proof"}]
        raise AssertionError(f"URL tak terduga: {url}")


def respons(teks=None, tool=None):
    if tool:
        nama, masukan = tool
        isi = [{"toolUse": {"toolUseId": "t1", "name": nama, "input": masukan}}]
        return {"output": {"message": {"role": "assistant", "content": isi}}, "stopReason": "tool_use",
                "usage": {"inputTokens": 100, "outputTokens": 10}}
    return {"output": {"message": {"role": "assistant", "content": [{"text": teks}]}}, "stopReason": "end_turn",
            "usage": {"inputTokens": 120, "outputTokens": 30}}


def test_tool_dipakai_lalu_dijawab():
    api, panggilan = ApiTiruan(), []
    antrian = [respons(tool=("daftar_po", {"status": "DRAFT"})), respons("Ada **1 draf PO**: Bacardi Gold Rum.")]

    def converse(**kw):
        panggilan.append(json.loads(json.dumps(kw)))
        return antrian.pop(0)

    hasil = inti.jawab("Draf PO apa saja?", 74, data=inti.DataToko(74, "http://api", api), converse=converse)
    assert hasil["jawaban"] == "Ada **1 draf PO**: Bacardi Gold Rum."
    assert hasil["alat"] == ["daftar_po"] and hasil["token_input"] == 220
    # Ringkasan toko dan tanggal simulasi ikut di prompt sistem; hasil tool dikirim balik ke model.
    assert "2017-01-07" in panggilan[0]["system"][0]["text"] and "PAENTMARWY" in panggilan[0]["system"][0]["text"]
    hasil_tool = panggilan[1]["messages"][-1]["content"][0]["toolResult"]["content"][0]["json"]
    assert hasil_tool["po"][0]["po_id"] == "PO-1"
    assert any("/purchase-orders?store=74&status=DRAFT" in u for u in api.url)


def test_hanya_tool_baca():
    nama = {t["toolSpec"]["name"] for t in inti.TOOLS}
    assert nama == {"prioritas_toko", "daftar_sku", "detail_sku", "cek_substitusi", "daftar_po", "daftar_hold",
                    "realokasi_modal", "status_guardrail", "riwayat_agent"}
    assert inti.DataToko(74, "http://api", ApiTiruan()).jalankan("draft_purchase_order", {}) == {
        "error": "Tool draft_purchase_order tidak dikenal"}


def test_cari_sku_dengan_nama():
    hasil = inti.DataToko(74, "http://api", ApiTiruan()).jalankan("daftar_sku", {"cari": "smirnoff"})
    assert [s["inventory_id"] for s in hasil["sku"]] == ["74_X_2"] and hasil["jumlah_cocok"] == 1


def test_riwayat_bergantian_dan_dimulai_user():
    pesan = inti._riwayat([{"peran": "assistant", "teks": "Halo"}, {"peran": "user", "teks": "A"},
                           {"peran": "user", "teks": "B"}, {"peran": "assistant", "teks": "C"},
                           {"peran": "sistem", "teks": "abaikan"}])
    assert [(p["role"], p["content"][0]["text"]) for p in pesan] == [("user", "A\n\nB"), ("assistant", "C")]


def test_batas_putaran_tool():
    def converse(**kw):
        return respons(tool=("daftar_hold", {}))

    class Api(ApiTiruan):
        def __call__(self, url):
            return [] if "/holds" in url else super().__call__(url)

    hasil = inti.jawab("Semua data", 74, data=inti.DataToko(74, "http://api", Api()), converse=converse)
    assert len(hasil["alat"]) == inti.MAKS_PUTARAN and "terlalu banyak" in hasil["jawaban"]


def event(metode="POST", body=None, path="/tanya"):
    return {"rawPath": path, "requestContext": {"http": {"method": metode}}, "body": json.dumps(body or {})}


def test_handler(monkeypatch):
    assert lambda_handler.handler(event("GET", path="/"), None)["statusCode"] == 200
    salah = lambda_handler.handler(event(body={"store": 74, "pertanyaan": ""}), None)
    assert salah["statusCode"] == 422 and json.loads(salah["body"])["detail"]["kode"] == "PERMINTAAN_TIDAK_VALID"

    monkeypatch.setattr(lambda_handler, "jawab", lambda p, s, r: {"jawaban": f"toko {s}: {p}", "riwayat": len(r)})
    ok = lambda_handler.handler(event(body={"store": 74, "pertanyaan": " Halo ", "riwayat": [
        {"peran": "user", "teks": "x"}]}), None)
    assert ok["statusCode"] == 200 and json.loads(ok["body"]) == {"jawaban": "toko 74: Halo", "riwayat": 1}

    def gagal(*a):
        raise RuntimeError("Bedrock mati")

    monkeypatch.setattr(lambda_handler, "jawab", gagal)
    r = lambda_handler.handler(event(body={"store": 74, "pertanyaan": "Halo"}), None)
    assert r["statusCode"] == 502 and "Bedrock" not in r["body"]  # detail galat hanya ke log
