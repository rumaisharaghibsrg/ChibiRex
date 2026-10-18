"""Uji rumus mesin hitung dengan data sintetis kecil yang bisa dihitung manual."""

import math

import duckdb
import pytest

from engine import config, metrics, stock

# SKU 100: stok awal 10, terima 20 (5 Jan), terjual 3 (2 Jan) + 5 (10 Jan), stok akhir 22.
# SKU 200: tanpa stok awal, terjual 2 (3 Jan) sebelum barang diterima 5 (4 Jan) -> stok sempat -2.
# SKU 300: stok awal 4, habis terjual 15 Jan, tidak ada pembelian -> harus REORDER.
# SKU 400: stok awal 5, tidak pernah terjual -> DEADSTOCK.
SETUP_SQL = """
create table raw_beg_inv as select * from (values
    ('1_KOTA_100', 1, 'KOTA', 100, 10),
    ('1_KOTA_300', 1, 'KOTA', 300, 4),
    ('1_KOTA_400', 1, 'KOTA', 400, 5)
) t(InventoryId, Store, City, Brand, onHand);

create table raw_end_inv as select * from (values
    ('1_KOTA_100', 1, 'KOTA', 100, 22),
    ('1_KOTA_200', 1, 'KOTA', 200, 3),
    ('1_KOTA_400', 1, 'KOTA', 400, 5)
) t(InventoryId, Store, City, Brand, onHand);

create table raw_purchases as select * from (values
    ('1_KOTA_100', 1, 100, 7, 'VENDOR A', 1, date '2015-12-28', date '2016-01-05', date '2016-02-15', 20, 200.0),
    ('1_KOTA_200', 1, 200, 7, 'VENDOR A', 2, date '2015-12-30', date '2016-01-04', date '2016-02-14', 5, 50.0)
) t(InventoryId, Store, Brand, VendorNumber, VendorName, PONumber, PODate, ReceivingDate, PayDate, Quantity, Dollars);

create table raw_sales as select * from (values
    ('1_KOTA_100', 1, date '2016-01-02', 3),
    ('1_KOTA_100', 1, date '2016-01-10', 5),
    ('1_KOTA_200', 1, date '2016-01-03', 2),
    ('1_KOTA_300', 1, date '2016-01-15', 4)
) t(InventoryId, Store, SalesDate, SalesQuantity);

create table raw_price_list as select * from (values
    (100, 'Produk 100', '750mL', 1, 15.0, 10.0, 7),
    (200, 'Produk 200', '750mL', 2, 12.0, 8.0, 7),
    (300, 'Produk 300', '750mL', 1, 20.0, 14.0, 7),
    (400, 'Produk 400', '750mL', 1, 30.0, 25.0, 7)
) t(Brand, Description, Size, Classification, Price, PurchasePrice, VendorNumber);
"""


@pytest.fixture(scope="module")
def con():
    con = duckdb.connect()
    con.execute(SETUP_SQL)
    stock.build(con)
    metrics.build(con)
    yield con
    con.close()


def sku(con, inventory_id):
    rel = con.execute("select * from sku_metrics where inventory_id = ?", [inventory_id])
    cols = [d[0] for d in rel.description]
    return dict(zip(cols, rel.fetchone()))


def stok_pada(con, inventory_id, tanggal):
    return con.execute(
        "select stok_akhir_hari from stok_harian_jan where inventory_id = ? and tanggal = ?",
        [inventory_id, tanggal],
    ).fetchone()[0]


def test_rekonstruksi_stok_harian(con):
    assert stok_pada(con, "1_KOTA_100", "2016-01-01") == 10
    assert stok_pada(con, "1_KOTA_100", "2016-01-02") == 7
    assert stok_pada(con, "1_KOTA_100", "2016-01-05") == 27
    assert stok_pada(con, "1_KOTA_100", "2016-01-31") == 22
    assert con.execute("select count(distinct tanggal) from stok_harian_jan").fetchone()[0] == 31


def test_stok_negatif_menurunkan_data_confidence(con):
    assert sku(con, "1_KOTA_100")["data_confidence"] == 1.0
    s200 = sku(con, "1_KOTA_200")
    assert s200["stok_min_jan"] == -2
    assert s200["data_confidence"] == pytest.approx(1 - 2 / 5)


def test_lead_time_vendor(con):
    v = con.execute("select lead_time_rata, lead_time_sd, hari_bayar from vendor_metrics where vendor_number = 7").fetchone()
    assert v[0] == pytest.approx(6.5)  # PO1: 8 hari, PO2: 5 hari
    assert v[1] == pytest.approx(math.sqrt(4.5))
    assert v[2] == pytest.approx(41)  # 41 hari setelah barang diterima


def test_vs_safety_stock_dan_reorder_point(con):
    s = sku(con, "1_KOTA_100")
    assert s["jual_tahun_implisit"] == 8
    assert s["hari_aktif"] == 366
    # Iavg Januari = (10 + 7*3 + 27*5 + 22*22) / 31 = 650 / 31
    assert s["vs_jan"] == pytest.approx(8 / 650, abs=1e-4)
    assert s["vs_tahun"] == pytest.approx(8 / (366 * 16), abs=1e-4)

    d = 8 / 366
    harian = [3, 5] + [0] * 29
    mean = sum(harian) / 31
    cv = math.sqrt(sum(x * x for x in harian) / 31 - mean**2) / mean
    lt, lt_sd = 6.5, math.sqrt(4.5)
    ss = config.Z_SERVICE * math.sqrt(lt * (d * cv) ** 2 + d**2 * lt_sd**2)
    assert s["safety_stock"] == pytest.approx(ss, abs=0.05)
    assert s["reorder_point"] == pytest.approx(d * lt + ss, abs=0.05)


def test_hari_aktif_sku_baru_mulai_dari_barang_pertama_diterima(con):
    assert sku(con, "1_KOTA_200")["hari_aktif"] == 363  # 4 Jan s.d. 31 Des


def test_sku_metrics_memuat_semua_kolom_untuk_api(con):
    from api.schemas import Sku

    kolom = {d[0] for d in con.execute("select * from sku_metrics limit 0").description}
    # dari brand_jenis, risiko_stockout, atau dihitung API
    dihitung_api = {"jenis", "status_komplementer", "arah_tren", "risiko_stockout", "skor_risiko", "level_risiko"}
    assert set(Sku.model_fields) - dihitung_api <= kolom


def test_status_stok(con):
    assert sku(con, "1_KOTA_100")["status_stok"] == "OVERSTOCK"
    s300 = sku(con, "1_KOTA_300")
    assert s300["status_stok"] == "REORDER"
    assert s300["saran_qty_po"] > 0
    assert s300["hari_stok_kosong_jan"] == 17  # 15–31 Jan
    s400 = sku(con, "1_KOTA_400")
    assert s400["status_stok"] == "DEADSTOCK"
    assert s400["kelebihan_unit"] == 5
