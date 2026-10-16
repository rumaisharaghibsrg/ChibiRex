from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_BIBITOR = ROOT / "data" / "raw" / "bibitor"
DB_PATH = ROOT / "data" / "processed" / "chibirex.duckdb"
KAGGLE_BIBITOR = "bhanupratapbiswas/inventory-analysis-case-study"
RAW_INSTACART = ROOT / "data" / "raw" / "instacart"
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

KURS_USD_IDR = 16_000  # kurs simulasi tetap; semua nilai Rupiah diberi label "simulasi"
Z_SERVICE = 1.65  # service level 95%
REVIEW_DAYS = 14  # periode review untuk target stok (order-up-to)
OVERSTOCK_DAYS = 180  # stok cukup > 180 hari dianggap berlebih

# Market Basket: sebuah jenis punya peran komplementer kalau ada jenis lain yang dibeli bersamanya
# minimal 1,5× lebih sering dibanding order alkohol pada umumnya, dengan minimal 30 order bersama.
BASKET_MIN_LIFT = 1.5
BASKET_MIN_ORDERS = 30
