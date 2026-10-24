"""Pengaturan API dan ambang guardrail. Semua ambang ditetapkan pengguna dan bisa diubah di sini."""

import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import httpx

from engine import config
from sap_mock import SERVICE

# Dashboard yang boleh memanggil API dari browser: Vite lokal dan dashboard Vercel (termasuk preview deploy-nya).
CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,https://chibirex-dashboard.vercel.app"
CORS_ORIGIN_REGEX = r"https://chibirex-dashboard(-[a-z0-9-]+)?\.vercel\.app"


def di_lambda() -> bool:
    return "AWS_LAMBDA_FUNCTION_NAME" in os.environ


def _path_tulis(env: str, nama: str) -> Path:
    """File SQLite yang ditulis API. Di Lambda hanya /tmp yang bisa ditulis (dan isinya hilang saat cold start;
    nanti diganti database terkelola), di laptop di data/processed."""
    if env in os.environ:
        return Path(os.environ[env])
    return Path("/tmp") / nama if di_lambda() else config.ROOT / "data" / "processed" / nama


@dataclass
class Settings:
    analytics_db: Path = config.DB_PATH
    # State transaksi (draf PO, hold, audit) terpisah dari chibirex.duckdb, supaya pipeline bisa
    # dibangun ulang tanpa menghapus riwayat. Di produksi pindah ke database terkelola.
    state_db: Path = field(default_factory=lambda: _path_tulis("CHIBIREX_STATE_DB", "state.sqlite"))

    batas_po_harian_idr: float = 100_000_000  # total nilai PO per toko per hari
    data_confidence_min: float = 0.8  # di bawah ini agent beralih ke rekomendasi audit fisik
    outlier_sigma: float = 3.0  # qty PO > target stok + 3σ permintaan dianggap lonjakan tidak wajar
    cb_max_pelanggaran: int = 3  # circuit breaker terbuka setelah 3 PO ditahan guardrail...
    cb_jendela_menit: int = 60  # ...dalam 60 menit terakhir

    exploration_persen: float = 0.10  # 10% dari PO yang ditahan tetap dibeli sebagai stok uji
    exploration_review_hari: int = 90  # hold ditinjau ulang tiap kuartal
    tren_naik_min: float = 1.2  # SKU tujuan pengalihan modal minimal naik 20%

    # Jam simulasi (api/simulasi.py): waktu maju dari 31 Des 2016 lewat tombol dashboard atau otomatis.
    simulasi_hari_maks: int = 90  # satu kuartal, sama dengan siklus review Hold Reorder

    # SAP: PO yang disetujui manajer dikirim ke URL ini. Default-nya tiruan SAP yang ikut ter-mount di
    # API ini (/sap); ganti lewat CHIBIREX_SAP_URL untuk SAP lain (misalnya tiruan di port terpisah).
    sap_base_url: str = os.environ.get("CHIBIREX_SAP_URL", "http://127.0.0.1:8000/sap" + SERVICE)
    sap_mock_db: Path = field(default_factory=lambda: _path_tulis("CHIBIREX_SAP_MOCK_DB", "sap_mock.sqlite"))
    sap_mock_app: Any = None  # aplikasi tiruan SAP yang di-mount di /sap; dibuat otomatis kalau kosong
    sap_client: Callable[[], httpx.Client] | None = None  # klien HTTP ke SAP (test memakai tiruan in-process)
    # Di Lambda tidak ada server di 127.0.0.1, jadi tiruan SAP yang ter-mount dipanggil langsung di proses yang
    # sama (tetap lewat alur OData + CSRF yang sama), kecuali CHIBIREX_SAP_URL diisi.
    sap_dalam_proses: bool = field(default_factory=lambda: di_lambda() and "CHIBIREX_SAP_URL" not in os.environ)

    # Dashboard memanggil API dari origin lain, jadi perlu CORS. Ganti lewat CHIBIREX_CORS_ORIGINS (dipisah koma).
    cors_origins: list[str] = field(default_factory=lambda: os.environ.get(
        "CHIBIREX_CORS_ORIGINS", CORS_ORIGINS).split(","))
    cors_origin_regex: str | None = field(default_factory=lambda: os.environ.get(
        "CHIBIREX_CORS_ORIGIN_REGEX", CORS_ORIGIN_REGEX))
    # Fungsi yang menjalankan agent untuk tombol "Jalankan agent" di dashboard (dipakai test); kosong = ikut agent_mode.
    agent_runner: Callable[..., dict] | None = None
    # Cara tombol "Jalankan agent" menjalankan agent:
    # - "lokal": agent Strands + Ollama di thread proses API ini (API di laptop, `uvicorn`).
    # - "antrian": tugas masuk antrian di state; worker di laptop (`python -m agent.worker`) mengambilnya,
    #   menjalankan agent dengan Ollama, dan melaporkan setiap langkah ke API. Untuk API di Lambda + LLM di laptop.
    # - "mati": tombol menjawab 503. Default di Lambda, karena thread latar dibekukan setelah respons terkirim.
    agent_mode: str = field(default_factory=lambda: os.environ.get(
        "CHIBIREX_AGENT_MODE", "mati" if di_lambda() else "lokal"))
    # Token rahasia worker (header X-Worker-Token). Kosong = endpoint worker tidak dikunci (API di laptop dan test).
    worker_token: str | None = field(default_factory=lambda: os.environ.get("CHIBIREX_WORKER_TOKEN") or None)
    worker_batas_menunggu_dtk: int = 30  # tugas yang tidak diambil worker selama ini dianggap gagal
    worker_batas_berjalan_dtk: int = 300  # tugas yang berjalan lebih lama dari ini dianggap macet
    worker_aktif_dtk: int = 15  # worker dianggap aktif kalau terakhir mengambil antrian dalam rentang ini

    clock: Callable[[], datetime] = datetime.now
