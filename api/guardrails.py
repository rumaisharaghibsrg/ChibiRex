"""Guardrail di kode, bukan di prompt: agent tidak bisa melewatinya walaupun instruksinya dimanipulasi."""

import math
import sqlite3
from datetime import datetime, timedelta

from api.settings import Settings
from engine import config
from engine.format import angka, rupiah


def pelanggaran(kode: str, pesan: str) -> dict:
    return {"kode": kode, "pesan": pesan}


def batas_qty_wajar(sku: dict, sigma_kali: float) -> int:
    """Qty PO maksimal yang masih wajar: target stok + kσ permintaan selama (lead time + review) − stok."""
    horizon = sku["lead_time_rata"] + config.REVIEW_DAYS
    batas = sku["target_stok"] + sigma_kali * sku["sigma_harian"] * math.sqrt(horizon) - sku["stok_akhir"]
    return max(0, math.ceil(batas))


def confidence_hitung_fisik(stok_sistem: int, stok_fisik: int) -> float:
    """Porsi stok sistem yang terbukti ada saat dihitung fisik: 1 - |fisik - sistem| / sistem.
    Selisih 25% (misalnya susut atau salah catat) memberi 0,75, di bawah ambang 0,8."""
    return round(max(0.0, 1 - abs(stok_fisik - stok_sistem) / max(stok_sistem, 1)), 3)


def total_po_hari_ini(con: sqlite3.Connection, store: int, sekarang: datetime) -> float:
    return con.execute(
        """select coalesce(sum(nilai_idr), 0) from purchase_orders
           where store = ? and status in ('DRAFT', 'APPROVED') and substr(dibuat_pada, 1, 10) = ?""",
        (store, sekarang.date().isoformat()),
    ).fetchone()[0]


def status_circuit_breaker(con: sqlite3.Connection) -> sqlite3.Row:
    return con.execute("select terbuka, alasan, berubah_pada from circuit_breaker where id = 1").fetchone()


def cek_po(con: sqlite3.Connection, s: Settings, sku: dict, qty: int, nilai: float,
           sekarang: datetime) -> list[dict]:
    hasil = []
    breaker = status_circuit_breaker(con)
    if breaker["terbuka"]:
        hasil.append(pelanggaran(
            "CIRCUIT_BREAKER",
            f"Circuit breaker aktif sejak {breaker['berubah_pada']} ({breaker['alasan']}). "
            "Semua PO baru ditahan sampai manajer mereset."))
    if sku["data_confidence"] < s.data_confidence_min:
        hasil.append(pelanggaran(
            "DATA_CONFIDENCE_RENDAH",
            f"Data Confidence Score {angka(sku['data_confidence'], 2)} di bawah ambang {angka(s.data_confidence_min, 2)}. "
            "Lakukan audit fisik stok sebelum memesan."))
    batas = batas_qty_wajar(sku, s.outlier_sigma)
    if qty > batas:
        hasil.append(pelanggaran(
            "OUTLIER_3SIGMA",
            f"Qty {qty} melebihi batas wajar {batas} unit (target stok + {s.outlier_sigma:g}σ permintaan "
            "selama lead time + review). Kemungkinan lonjakan borongan/promo, perlu review manusia."))
    total = total_po_hari_ini(con, sku["store"], sekarang)
    if total + nilai > s.batas_po_harian_idr:
        hasil.append(pelanggaran(
            "BATAS_HARIAN",
            f"Total PO toko {sku['store']} hari ini akan menjadi {rupiah(total + nilai)}, "
            f"melebihi batas {rupiah(s.batas_po_harian_idr)}."))
    return hasil


def perbarui_circuit_breaker(con: sqlite3.Connection, s: Settings, sekarang: datetime) -> bool:
    """Buka circuit breaker kalau jumlah PO yang ditahan guardrail dalam jendela waktu mencapai batas."""
    if status_circuit_breaker(con)["terbuka"]:
        return False
    sejak = (sekarang - timedelta(minutes=s.cb_jendela_menit)).isoformat(timespec="seconds")
    n = con.execute(
        "select count(*) from purchase_orders where status = 'DITAHAN_GUARDRAIL' and dibuat_pada >= ?", (sejak,)
    ).fetchone()[0]
    if n < s.cb_max_pelanggaran:
        return False
    alasan = f"{n} PO ditahan guardrail dalam {s.cb_jendela_menit} menit terakhir"
    con.execute("update circuit_breaker set terbuka = 1, alasan = ?, berubah_pada = ? where id = 1",
                (alasan, sekarang.isoformat(timespec="seconds")))
    return True


def arah_tren(sku: dict, s: Settings) -> str:
    """Label tren velocity yang dipakai guardrail, realokasi, dan agent (agar model tidak membandingkan angka)."""
    tren = sku["tren_beli"]
    if tren is None or sku["beli_jan_sep"] < config.TREN_BASIS_MIN:
        return "TIDAK_ANDAL"
    if tren >= s.tren_naik_min:
        return "NAIK"
    return "TURUN" if tren < 1 else "STABIL"


def cek_hold(s: Settings, sku: dict, substitusi: dict) -> list[dict]:
    """Syarat Hold Reorder dari proposal: stok sudah di titik reorder, Vs turun, dan tidak komplementer."""
    hasil = []
    if not sku["perlu_reorder"]:
        hasil.append(pelanggaran(
            "TIDAK_PERLU_REORDER", "Stok masih di atas reorder point, jadi tidak ada reorder yang perlu ditahan."))
    arah = arah_tren(sku, s)
    if arah == "TIDAK_ANDAL":
        hasil.append(pelanggaran(
            "TREN_TIDAK_ANDAL",
            f"Pembelian Jan–Sep hanya {sku['beli_jan_sep']} unit (minimal {config.TREN_BASIS_MIN}) atau tren tidak "
            "diketahui, jadi penurunan Vs belum bisa dipercaya. Perlu review manusia."))
    elif arah != "TURUN":
        hasil.append(pelanggaran(
            "VS_TIDAK_TURUN",
            f"Hold hanya untuk SKU yang Vs-nya turun; tren beli SKU ini {angka(sku['tren_beli'], 2)}x ({arah})."))
    if substitusi["status"] == "KOMPLEMENTER":
        m = substitusi["mitra"][0]
        hasil.append(pelanggaran(
            "PUNYA_PERAN_KOMPLEMENTER",
            f"Jenis {substitusi['jenis']} dibeli bersama {m['jenis']} {angka(m['lift_alk'], 2)}x lebih sering dari biasanya. "
            "Menahan SKU ini berisiko menurunkan penjualan jenis lain."))
    elif substitusi["status"] == "TIDAK_DIKETAHUI":
        hasil.append(pelanggaran(
            "JENIS_TIDAK_DIKETAHUI", "Jenis minuman SKU ini tidak terpetakan, jadi peran komplementernya "
            "tidak bisa dicek. Perlu review manusia."))
    if sku["data_confidence"] < s.data_confidence_min:
        hasil.append(pelanggaran(
            "DATA_CONFIDENCE_RENDAH",
            f"Data Confidence Score {angka(sku['data_confidence'], 2)} di bawah ambang {angka(s.data_confidence_min, 2)}. "
            "Lakukan audit fisik stok dulu."))
    return hasil
