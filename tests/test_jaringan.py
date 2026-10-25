"""Uji dashboard jaringan (semua toko): statistik per toko dan peluang transfer stok antar toko."""

import duckdb
import pytest

from tests.api_data import buat_client, sku_id


@pytest.fixture
def db_dua_toko(analytics_db, tmp_path):
    """Data uji ditambah toko 2 yang kelebihan Bacardi (merek 10), merek yang perlu reorder di toko 1."""
    path = tmp_path / "dua_toko.duckdb"
    con = duckdb.connect(str(path))
    con.execute(f"attach '{analytics_db}' as asal (read_only)")
    for tabel in ("sku_metrics", "brand_jenis", "aturan_asosiasi", "risiko_stockout"):
        con.execute(f"create table {tabel} as select * from asal.{tabel}")
    con.execute("""insert into sku_metrics select * replace (2 as store, '2_KOTA_10' as inventory_id, 'KOTA2' as kota,
                       500 as stok_akhir, 'OVERSTOCK' as status_stok, false as perlu_reorder, 0 as saran_qty_po)
                   from asal.sku_metrics where inventory_id = '1_KOTA_10'""")
    con.close()
    return path


def test_ringkasan_semua_toko(db_dua_toko, tmp_path):
    with buat_client(db_dua_toko, tmp_path) as client:
        r = client.get("/jaringan/ringkasan").json()
        assert (r["jumlah_toko"], r["hari_ke"], r["per_tanggal"]) == (2, 0, "2016-12-31")
        toko1 = next(t for t in r["toko"] if t["store"] == 1)
        # Angkanya sama dengan dashboard per toko.
        satu = client.get("/stores/1/ringkasan").json()
        assert toko1["health_score"] == satu["health_score"]
        assert toko1["perlu_reorder"] == satu["jumlah_status"]["REORDER"]
        assert r["perlu_reorder"] == sum(t["perlu_reorder"] for t in r["toko"])

        # Bagian dari state (PO, hold) selalu terbaru walaupun statistik stok diambil dari cache.
        client.post("/purchase-orders", json={"inventory_id": sku_id(30), "alasan": "Penjualan naik, stok menipis"},
                    headers={"Idempotency-Key": "jaringan-po-0001"})
        toko1 = next(t for t in client.get("/jaringan/ringkasan").json()["toko"] if t["store"] == 1)
        assert toko1["po_menunggu"] == 1

        client.post("/simulasi/maju", json={"hari": 7})
        assert client.get("/jaringan/ringkasan").json()["per_tanggal"] == "2017-01-07"


def test_peluang_transfer_antar_toko(db_dua_toko, tmp_path):
    with buat_client(db_dua_toko, tmp_path) as client:
        r = client.get("/jaringan/transfer").json()
        assert [(t["dari_toko"], t["ke_toko"], t["ke_inventory_id"], t["qty"]) for t in r["transfer"]] == [
            (2, 1, sku_id(10), 70)]  # saran PO toko 1 (70) dipenuhi dari kelebihan toko 2 (380)
        assert r["transfer"][0]["status_dari"] == "OVERSTOCK"
        assert r["total_nilai_idr"] == 70 * 10.0 * 16_000


def test_stok_donor_tidak_dibagi_berlebih():
    from api.main import _bagi_transfer

    calon = [{"ke_inventory_id": f"{t}_K_10", "dari_inventory_id": "9_K_10", "kelebihan_unit": 100,
              "saran_qty_po": 70, "harga_beli_usd": 1.0, "dari_toko": 9, "ke_toko": t} for t in (1, 2, 3)]
    hasil = _bagi_transfer(calon)
    assert [h["qty"] for h in hasil] == [70, 30]  # toko ketiga tidak kebagian
