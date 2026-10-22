"""Pengaturan API dan ambang guardrail. Semua ambang ditetapkan pengguna dan bisa diubah di sini."""

import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import httpx

from engine import config
from sap_mock import SERVICE


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
    exploration_review_hari: int = 90  # hold ditinjau ulang tiap kuartal
    tren_naik_min: float = 1.2  # SKU tujuan pengalihan modal minimal naik 20%

    # SAP: PO yang disetujui manajer dikirim ke URL ini. Default-nya tiruan SAP yang ikut ter-mount di
    # API ini (/sap); ganti lewat CHIBIREX_SAP_URL untuk SAP lain (misalnya tiruan di port terpisah).
    sap_base_url: str = os.environ.get("CHIBIREX_SAP_URL", "http://127.0.0.1:8000/sap" + SERVICE)
    sap_mock_db: Path = config.ROOT / "data" / "processed" / "sap_mock.sqlite"
    sap_mock_app: Any = None  # aplikasi tiruan SAP yang di-mount di /sap; dibuat otomatis kalau kosong
    sap_client: Callable[[], httpx.Client] | None = None  # untuk test: klien HTTP ke SAP

    # Dashboard React (Vite dev server di port 5173) memanggil API dari origin lain, jadi perlu CORS.
    # Saat deploy, tambahkan domain dashboard lewat CHIBIREX_CORS_ORIGINS (dipisah koma).
    cors_origins: list[str] = field(default_factory=lambda: os.environ.get(
        "CHIBIREX_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","))
    # Fungsi yang menjalankan agent untuk tombol "Jalankan agent" di dashboard; kosong = agent Strands lokal.
    agent_runner: Callable[..., dict] | None = None
    # Agent lokal butuh Ollama dan thread latar. Di AWS Lambda keduanya tidak tersedia (thread dibekukan setelah
    # respons terkirim), jadi di sana tombol agent menunggu agent di Bedrock AgentCore.
    agent_lokal: bool = field(default_factory=lambda: "AWS_LAMBDA_FUNCTION_NAME" not in os.environ)

    clock: Callable[[], datetime] = datetime.now
