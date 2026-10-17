"""Uji tools agent terhadap API uji, tanpa LLM: bentuk data ringkas, penolakan sebagai data, dan pengaman."""

import pytest

from agent.tools import FIELD_PRIORITAS, MAKS_PANGGILAN, AlatAgent
from tests.api_data import sku_id


@pytest.fixture
def alat(client):
    a = AlatAgent(client, "run00000001", pembuat="agent uji")
    return a, {t.tool_name: t for t in a.tools()}


def test_list_prioritas_ringkas(alat):
    a, t = alat
    r = t["list_prioritas"](store=1)
    assert [s["inventory_id"] for s in r["naik"]] == [sku_id(10)]
    assert set(r["naik"][0]) == set(FIELD_PRIORITAS)
    assert a.langkah[0]["tool"] == "list_prioritas"


def test_alur_hold_realokasi_dan_po(alat):
    _, t = alat
    t["list_prioritas"](store=1)
    assert t["check_substitution"](inventory_id=sku_id(20))["status"] == "TIDAK_KOMPLEMENTER"
    assert t["hold_reorder"](inventory_id=sku_id(20), alasan="Vs turun dan tidak komplementer")["status"] == "AKTIF"
    assert t["suggest_reallocation"](store=1)["tujuan"][0]["inventory_id"] == sku_id(10)
    po = t["draft_purchase_order"](inventory_id=sku_id(10), alasan="Penjualan naik dan perlu reorder")
    assert po["status"] == "DRAFT"
    assert po["pelanggaran"] == []


def test_penolakan_guardrail_dikembalikan_sebagai_data(alat):
    _, t = alat
    t["list_prioritas"](store=1)
    r = t["hold_reorder"](inventory_id=sku_id(30), alasan="turun")  # alasan pendek tetap diterima
    assert r["ditolak"] is True
    assert r["kode"] == "HOLD_DITOLAK"
    assert "PUNYA_PERAN_KOMPLEMENTER" in {p["kode"] for p in r["pelanggaran"]}


def test_tindakan_hanya_untuk_sku_prioritas(alat, client):
    _, t = alat
    assert t["draft_purchase_order"](inventory_id=sku_id(10), alasan="naik")["kode"] == "PRIORITAS_BELUM_DIAMBIL"
    t["list_prioritas"](store=1)
    # 30 ada di daftar 'turun', jadi tidak boleh dibuatkan PO; 10 ada di 'naik', jadi tidak boleh di-hold.
    assert t["draft_purchase_order"](inventory_id=sku_id(30), alasan="naik")["kode"] == "BUKAN_DAFTAR_NAIK"
    assert t["hold_reorder"](inventory_id=sku_id(10), alasan="turun")["kode"] == "BUKAN_DAFTAR_TURUN"
    assert client.get("/purchase-orders").json() == []


def test_po_tidak_ganda_dalam_satu_sesi(alat, client):
    _, t = alat
    t["list_prioritas"](store=1)
    a = t["draft_purchase_order"](inventory_id=sku_id(10), alasan="Penjualan naik dan perlu reorder")
    b = t["draft_purchase_order"](inventory_id=sku_id(10), alasan="Penjualan naik dan perlu reorder")
    assert a["po_id"] == b["po_id"]
    c = t["draft_purchase_order"](inventory_id=sku_id(10), alasan="Alasan lain untuk SKU yang sama")
    assert c["kode"] == "IDEMPOTENCY_KEY_BENTROK"
    assert len(client.get("/purchase-orders").json()) == 1


def test_id_karangan_mendapat_error(alat):
    _, t = alat
    assert "error" in t["get_sku_metrics"](inventory_id="sku-ngarang")
    assert t["get_sku_metrics"](inventory_id="1_KOTA_999")["kode"] == "SKU_TIDAK_ADA"


def test_batas_jumlah_panggilan(alat):
    a, t = alat
    for _ in range(MAKS_PANGGILAN):
        t["list_prioritas"](store=1)
    assert "Batas" in t["list_prioritas"](store=1)["error"]
    assert len(a.langkah) == MAKS_PANGGILAN + 1
