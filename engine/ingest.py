"""Unduh data Bibitor dari Kaggle dan muat ke DuckDB sebagai tabel raw_*."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

import duckdb

from engine import config

FILES = {
    "raw_beg_inv": "BegInvFINAL12312016.csv",
    "raw_end_inv": "EndInvFINAL12312016.csv",
    "raw_purchases": "PurchasesFINAL12312016.csv",
    "raw_sales": "SalesFINAL12312016.csv",
    "raw_price_list": "2017PurchasePricesDec.csv",
    "raw_invoices": "InvoicePurchases12312016.csv",
}


def _kaggle_exe() -> str:
    local = Path(sys.executable).with_name("kaggle.exe" if os.name == "nt" else "kaggle")
    if local.exists():
        return str(local)
    found = shutil.which("kaggle")
    if not found:
        raise RuntimeError("Kaggle CLI tidak ditemukan. Aktifkan .venv lalu jalankan `kaggle auth login`.")
    return found


def download(raw_dir: Path = config.RAW_BIBITOR) -> None:
    if all((raw_dir / f).exists() for f in FILES.values()):
        return
    raw_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [_kaggle_exe(), "datasets", "download", "-d", config.KAGGLE_BIBITOR, "-p", str(raw_dir), "--unzip"],
        check=True,
    )


def load(con: duckdb.DuckDBPyConnection, raw_dir: Path = config.RAW_BIBITOR) -> None:
    for table, filename in FILES.items():
        path = (raw_dir / filename).as_posix()
        con.execute(f"create or replace table {table} as select * from read_csv_auto('{path}', sample_size=-1)")
    # Nama vendor di file asli berisi spasi di belakang.
    for table, col in [("raw_purchases", "VendorName"), ("raw_sales", "VendorName"),
                       ("raw_price_list", "VendorName"), ("raw_invoices", "VendorName")]:
        con.execute(f"update {table} set {col} = trim({col})")
