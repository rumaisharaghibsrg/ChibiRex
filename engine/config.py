from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_BIBITOR = ROOT / "data" / "raw" / "bibitor"
DB_PATH = ROOT / "data" / "processed" / "chibirex.duckdb"
KAGGLE_BIBITOR = "bhanupratapbiswas/inventory-analysis-case-study"
RAW_INSTACART = ROOT / "data" / "raw" / "instacart"
# Mirror dataset Product Backorders lengkap (1,69 juta baris train); lisensi di Kaggle: unknown.
RAW_BACKORDERS = ROOT / "data" / "raw" / "backorders"
KAGGLE_BACKORDERS = "chandanareddy12/back-order-prediction"
RAW_ONLINE_RETAIL = ROOT / "data" / "raw" / "online_retail"
KAGGLE_ONLINE_RETAIL = "mashlyn/online-retail-ii-uci"
MODEL_DIR = ROOT / "models"
MODEL_RISIKO = MODEL_DIR / "risiko_stockout.txt"
MODEL_RISIKO_METRIK = MODEL_DIR / "risiko_stockout_metrik.json"
# Level risiko stok habis dari skor peringkat 0-100 (Confidence Score alert).
RISIKO_TINGGI = 90
RISIKO_SEDANG = 70
# File kompetisi Instacart tidak tersedia lewat API Kaggle; mirror ini berisi file yang identik.
KAGGLE_INSTACART = "psparks/instacart-market-basket-analysis"

# "Hari ini" untuk demo = tanggal snapshot stok akhir Bibitor.
AS_OF = "2016-12-31"

# Penjualan harian Bibitor hanya lengkap untuk Januari 2016 (file Sales terpotong di
# 1.048.575 baris, batas Excel). Februari hanya berisi 11 dari 79 toko, jadi tidak dipakai.
JAN_START = "2016-01-01"
JAN_END = "2016-01-31"

# Data Bibitor konsisten sempurna (tidak pernah terjual melebihi stok), jadi penjualan setahun
# = stok awal + pembelian − stok akhir. Laju permintaan = penjualan itu ÷ hari SKU aktif.
YEAR_START = "2016-01-01"
DAYS_IN_YEAR = 366  # 2016 tahun kabisat
MIN_ACTIVE_DAYS = 30  # batas bawah hari aktif agar SKU yang baru masuk tidak menghasilkan laju ekstrem

# Tren velocity: rata-rata pembelian per bulan Okt–Des dibanding Jan–Sep. Di Januari, median rasio
# penjualan/pembelian per toko adalah 1,02, jadi pola pembelian mengikuti pola penjualan.
Q4_START = "2016-10-01"
# Tren baru dianggap bermakna kalau pembelian Jan–Sep minimal 90 unit (±10 unit/bulan). Tanpa ini,
# produk baru atau yang sangat jarang dibeli bisa terlihat "naik 200x" dari basis beberapa unit.
TREN_BASIS_MIN = 90

KURS_USD_IDR = 16_000  # kurs simulasi tetap; semua nilai Rupiah diberi label "simulasi"
Z_SERVICE = 1.65  # service level 95%
REVIEW_DAYS = 14  # periode review untuk target stok (order-up-to)
OVERSTOCK_DAYS = 180  # stok cukup > 180 hari dianggap berlebih

# Market Basket: sebuah jenis punya peran komplementer kalau ada jenis lain yang dibeli bersamanya
# minimal 1,5× lebih sering dibanding order alkohol pada umumnya, dengan minimal 30 order bersama.
BASKET_MIN_LIFT = 1.5
BASKET_MIN_ORDERS = 30
