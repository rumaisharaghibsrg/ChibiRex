"""Database analitik sintetis untuk test API dan tools agent, dengan skenario yang terkontrol."""

from datetime import date, datetime

import duckdb
import pandas as pd
from fastapi.testclient import TestClient

from api.main import create_app
from api.settings import Settings
from sap_mock import SERVICE
from sap_mock.app import create_sap_mock

SEKARANG = datetime(2026, 10, 17, 10, 0, 0)
KURS = 16_000

DASAR = dict(
    store=1, kota="KOTA", ukuran="750mL", kategori="spirits", vendor_number=7, vendor_name="VENDOR A",
    status_stok="REORDER", stok_akhir=50, permintaan_harian=5.0, sigma_harian=4.0, lead_time_rata=8.0,
    safety_stock=20.0, reorder_point=60.0, target_stok=120.0, hari_cukup=10.0, tgl_perkiraan_habis=date(2017, 1, 10),
    perlu_reorder=True, saran_qty_po=70, kelebihan_unit=0.0, harga_beli_usd=10.0, margin_pct=0.3,
    nilai_stok_idr=8_000_000.0,
    modal_berlebih_idr=0.0, vs_jan=0.01, vs_tahun=0.02, tren_beli=1.0, beli_jan_sep=900, beli_q4=300,
    hari_stok_kosong_jan=0, data_confidence=1.0,
)

# brand: (deskripsi, jenis, status_komplementer, perubahan dari DASAR)
SKU = {
    10: ("Bacardi Gold Rum", "rum", "KOMPLEMENTER", dict(tren_beli=3.0)),
    20: ("Ciroc Apple Vodka", "vodka", "TIDAK_KOMPLEMENTER", dict(tren_beli=0.4, harga_beli_usd=20.0)),
    30: ("Patron Reposado Tequila", "tequila", "KOMPLEMENTER", dict(tren_beli=0.3)),
    40: ("Ruffino Chianti", "wine_red", "TIDAK_KOMPLEMENTER", dict(tren_beli=0.5, data_confidence=0.5, kategori="wine")),
    50: ("Smirnoff 80 Proof", "vodka", "TIDAK_KOMPLEMENTER",
         dict(status_stok="AMAN", perlu_reorder=False, saran_qty_po=0, stok_akhir=200, tren_beli=0.8)),
    60: ("Mystery Spirit", "spirits_lain", "TIDAK_DIKETAHUI", dict(tren_beli=0.2)),
    # Basis Jan–Sep kecil: "naik 50x" / "turun 0,2x" dari beberapa unit saja tidak boleh dipercaya.
    70: ("Ciroc Mango Vodka", "vodka", "TIDAK_KOMPLEMENTER", dict(tren_beli=50.0, beli_jan_sep=12)),
    80: ("Gallo Pinot Grigio", "wine_white", "TIDAK_KOMPLEMENTER", dict(tren_beli=0.2, beli_jan_sep=20)),
}


def sku_id(brand: int) -> str:
    return f"1_KOTA_{brand}"


def buat_analytics_db(path) -> None:
    rows, jenis = [], []
    for brand, (deskripsi, j, status, ubah) in SKU.items():
        row = {**DASAR, "inventory_id": sku_id(brand), "brand": brand, "deskripsi": deskripsi, **ubah}
        row["nilai_saran_po_idr"] = row["saran_qty_po"] * row["harga_beli_usd"] * KURS
        rows.append(row)
        jenis.append({"brand": brand, "jenis": j, "status_komplementer": status})
    aturan = pd.DataFrame([
        {"antecedent": "rum", "consequent": "gin", "consequent_alkohol": True, "n_xy": 78, "lift_alk": 2.4},
        {"antecedent": "tequila", "consequent": "liqueur", "consequent_alkohol": True, "n_xy": 160, "lift_alk": 3.2},
        {"antecedent": "vodka", "consequent": "gin", "consequent_alkohol": True, "n_xy": 319, "lift_alk": 1.46},
    ])
    risiko = pd.DataFrame([
        {"inventory_id": sku_id(10), "risiko_stockout": 0.31, "skor_risiko": 96, "level_risiko": "TINGGI"},
        {"inventory_id": sku_id(20), "risiko_stockout": 0.05, "skor_risiko": 60, "level_risiko": "RENDAH"},
    ])
    sku_df, jenis_df = pd.DataFrame(rows), pd.DataFrame(jenis)
    con = duckdb.connect(str(path))
    con.execute("create table sku_metrics as select * from sku_df")
    con.execute("create table brand_jenis as select * from jenis_df")
    con.execute("create table aturan_asosiasi as select * from aturan")
    con.execute("create table risiko_stockout as select * from risiko")
    con.close()


def buat_client(analytics_db, tmp_path, **ubah) -> TestClient:
    # Tiruan SAP memakai database sementara; API mengirim PO ke sana lewat TestClient (tanpa jaringan).
    sap_app = create_sap_mock(tmp_path / "sap_mock.sqlite")
    # worker_token None: token di .env laptop (untuk worker) tidak boleh ikut mengunci API di test.
    pengaturan = {"sap_mock_app": sap_app, "worker_token": None, "clock": lambda: SEKARANG,
                  "sap_client": lambda: TestClient(sap_app, base_url="http://testserver" + SERVICE), **ubah}
    # Semua file yang ditulis API diarahkan ke tmp_path, supaya test tidak pernah menyentuh data/processed.
    settings = Settings(analytics_db=analytics_db, state_db=tmp_path / "state.sqlite",
                        sap_mock_db=tmp_path / "sap_mock.sqlite", **pengaturan)
    return TestClient(create_app(settings))
