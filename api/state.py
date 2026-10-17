"""State transaksional API di SQLite: draf PO, hold, idempotency key, circuit breaker, dan audit log."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

SCHEMA = """
create table if not exists purchase_orders (
    po_id text primary key,
    inventory_id text not null,
    store integer not null,
    deskripsi text,
    vendor_number integer,
    vendor_name text,
    qty integer not null,
    harga_beli_usd real not null,
    nilai_idr real not null,
    status text not null,         -- DRAFT, DITAHAN_GUARDRAIL, APPROVED, REJECTED
    pelanggaran text not null,    -- JSON list guardrail yang dilanggar
    alasan text not null,
    dibuat_oleh text not null,
    dibuat_pada text not null,
    diputuskan_oleh text,
    diputuskan_pada text,
    catatan_keputusan text,
    sap_po_number text,           -- nomor PO di SAP setelah disetujui dan terkirim
    sap_dikirim_pada text
);

create table if not exists holds (
    hold_id text primary key,
    inventory_id text not null,
    store integer not null,
    deskripsi text,
    qty_ditahan integer not null,
    modal_ditahan_idr real not null,
    qty_uji integer not null,
    nilai_uji_idr real not null,
    modal_diselamatkan_idr real not null,
    review_pada text not null,
    status text not null,         -- AKTIF, SELESAI
    alasan text not null,
    dibuat_oleh text not null,
    dibuat_pada text not null
);
create unique index if not exists hold_aktif_per_sku on holds (inventory_id) where status = 'AKTIF';

create table if not exists idempotency (
    kunci text primary key,
    endpoint text not null,
    request_hash text not null,
    resource_id text not null,
    dibuat_pada text not null
);

create table if not exists circuit_breaker (
    id integer primary key check (id = 1),
    terbuka integer not null,
    alasan text,
    berubah_pada text
);
insert or ignore into circuit_breaker values (1, 0, null, null);

create table if not exists agent_runs (
    run_id text primary key,
    waktu text not null,
    tugas text not null,
    store integer,
    model text not null,
    jawaban text not null,
    langkah text not null,        -- JSON: daftar pemanggilan tool beserta input/output
    durasi_dtk real not null,
    token_input integer not null,
    token_output integer not null,
    berhasil integer not null
);

create table if not exists audit_log (
    id integer primary key autoincrement,
    waktu text not null,
    aktor text not null,
    aksi text not null,
    resource_id text,
    detail text not null
);
"""


def connect(path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(path, timeout=10, isolation_level=None)
    con.row_factory = sqlite3.Row
    return con


# Kolom yang ditambahkan setelah tabel pertama kali dibuat; ditambahkan otomatis ke database lama.
KOLOM_TAMBAHAN = {"purchase_orders": [("sap_po_number", "text"), ("sap_dikirim_pada", "text")]}


def init(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    con = connect(path)
    try:
        con.executescript(SCHEMA)
        for tabel, kolom in KOLOM_TAMBAHAN.items():
            ada = {r["name"] for r in con.execute(f"pragma table_info({tabel})")}
            for nama, tipe in kolom:
                if nama not in ada:
                    con.execute(f"alter table {tabel} add column {nama} {tipe}")
    finally:
        con.close()


@contextmanager
def transaksi(path: Path):
    """Transaksi tulis eksklusif (BEGIN IMMEDIATE): cek guardrail dan insert terjadi atomik, jadi dua
    request bersamaan tidak bisa sama-sama lolos batas harian atau memakai idempotency key yang sama."""
    con = connect(path)
    try:
        con.execute("begin immediate")
        yield con
        con.execute("commit")
    except BaseException:
        con.execute("rollback")
        raise
    finally:
        con.close()


@contextmanager
def baca(path: Path):
    con = connect(path)
    try:
        yield con
    finally:
        con.close()


def audit(con: sqlite3.Connection, waktu: datetime, aktor: str, aksi: str, resource_id: str | None,
          detail: dict) -> None:
    con.execute(
        "insert into audit_log (waktu, aktor, aksi, resource_id, detail) values (?, ?, ?, ?, ?)",
        (waktu.isoformat(timespec="seconds"), aktor, aksi, resource_id,
         json.dumps(detail, ensure_ascii=False, default=str)),
    )
