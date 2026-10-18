"""Uji Tahap 9: fitur model risiko stok habis, deteksi pesanan borongan, dan skenario Runaway PO."""

import csv
from datetime import date, timedelta

import duckdb
import pytest

from agent.skenario_runaway import jalankan
from engine import borongan, risiko
from tests.api_data import sku_id


def test_fitur_risiko_bebas_skala_dan_aman_dari_pembagian_nol():
    con = duckdb.connect()
    con.execute("""create table t as select * from (values
        (30, 0, 90, 10, 30, 90, 4),    -- stok 30, ramalan 30/bulan -> cukup 1 bulan
        (0, 0, 90, 10, 0, 0, 4),       -- stok habis, penjualan 3 bulan nol
        (5000, 0, 3, 1, 3, 9, 4),      -- stok sangat berlebih -> dibatasi 24 bulan
        (10, 0, 0, 0, 0, 0, null)      -- tanpa ramalan dan tanpa penjualan
    ) v(national_inv, in_transit_qty, forecast_3_month, sales_1_month, sales_3_month, sales_9_month, lead_time)""")
    rows = con.execute(f"select cover_forecast_bulan, stok_habis, ada_forecast, tren_jual_1v3 "
                       f"from ({risiko.sql_fitur('t')})").fetchall()
    assert rows[0] == (1.0, 0, 1, 1.0)
    assert rows[1][1] == 1 and rows[1][3] is None  # 0/0 menjadi kosong, bukan nilai batas
    assert rows[2][0] == risiko.BATAS_RASIO
    assert rows[3][0] is None and rows[3][2] == 0


def test_deteksi_pesanan_borongan(tmp_path):
    path = tmp_path / "retail.csv"
    mulai = date(2010, 1, 1)
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"])
        for i in range(40):  # produk 10001: 2 unit per hari, lalu satu hari borongan 200 unit
            w.writerow([f"5{i:05d}", "10001", "MUG", 200 if i == 20 else 2, f"{mulai + timedelta(days=i)} 10:00:00", 1.5, 1, "UK"])
        w.writerow(["C900000", "10001", "MUG", 5000, f"{mulai + timedelta(days=5)} 10:00:00", 1.5, 1, "UK"])  # pembatalan
        w.writerow(["900001", "POST", "POSTAGE", 9000, f"{mulai + timedelta(days=6)} 10:00:00", 18, 1, "UK"])  # bukan produk
    con = duckdb.connect()
    borongan.analisis(con, path)
    hari = con.execute("select kode, tanggal, qty from borongan_harian").fetchall()
    assert hari == [("10001", mulai + timedelta(days=20), 200)]
    assert con.execute("select kode_produk, hari_borongan from ringkasan_borongan").fetchone() == (1, 1)


def test_sku_membawa_level_risiko(client):
    r = client.get(f"/sku/{sku_id(10)}").json()
    assert (r["skor_risiko"], r["level_risiko"]) == (96, "TINGGI")
    assert client.get("/stores/1/prioritas").json()["naik"][0]["level_risiko"] == "TINGGI"
    assert client.get(f"/sku/{sku_id(30)}").json()["level_risiko"] is None  # belum punya skor


def test_skenario_runaway_po(client):
    hasil = jalankan(client, store=1, rasio=18.5, cetak=lambda *_: None)
    borongan_po, normal = hasil["po"][:3], hasil["po"][3]
    assert all(po["status"] == "DITAHAN_GUARDRAIL" for po in borongan_po)
    assert all("OUTLIER_3SIGMA" in {p["kode"] for p in po["pelanggaran"]} for po in borongan_po)
    assert hasil["breaker"]["circuit_breaker_terbuka"] is True
    assert normal["status"] == "DITAHAN_GUARDRAIL"
    assert {p["kode"] for p in normal["pelanggaran"]} == {"CIRCUIT_BREAKER"}
    assert client.get("/guardrails/status").json()["circuit_breaker_terbuka"] is False  # direset di akhir


def test_skenario_menolak_jalan_kalau_breaker_sudah_terbuka(client):
    jalankan(client, store=1, rasio=18.5, reset=False, cetak=lambda *_: None)
    with pytest.raises(RuntimeError, match="sudah terbuka"):
        jalankan(client, store=1, rasio=18.5, cetak=lambda *_: None)
