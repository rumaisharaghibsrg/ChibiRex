"""Pengaturan API dan ambang guardrail. Semua ambang ditetapkan pengguna dan bisa diubah di sini."""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

from engine import config


@dataclass
class Settings:
    analytics_db: Path = config.DB_PATH
    # State transaksi (draf PO, hold, audit) terpisah dari chibirex.duckdb, supaya pipeline bisa
    # dibangun ulang tanpa menghapus riwayat. Di produksi pindah ke RDS PostgreSQL.
    state_db: Path = config.ROOT / "data" / "processed" / "state.sqlite"

    batas_po_harian_idr: float = 100_000_000  # total nilai PO per toko per hari
    data_confidence_min: float = 0.8  # di bawah ini agent beralih ke rekomendasi audit fisik
    outlier_sigma: float = 3.0  # qty PO > target stok + 3σ permintaan dianggap lonjakan tidak wajar
    cb_max_pelanggaran: int = 3  # circuit breaker terbuka setelah 3 PO ditahan guardrail...
    cb_jendela_menit: int = 60  # ...dalam 60 menit terakhir

    exploration_persen: float = 0.10  # 10% dari PO yang ditahan tetap dibeli sebagai stok uji
    exploration_review_hari: int = 90  # hold ditinjau ulang setiap kuartal
    tren_naik_min: float = 1.2  # SKU tujuan pengalihan modal minimal naik 20%

    clock: Callable[[], datetime] = datetime.now
