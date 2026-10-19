"""Menjalankan agent dari dashboard di thread latar, supaya dashboard bisa menampilkan langkahnya selagi berjalan.

Hanya satu agent yang boleh berjalan dalam satu waktu (LLM lokal memakai satu GPU). Langkah yang sedang
berjalan disimpan di memori; setelah selesai, agent sendiri menyimpan jejak lengkapnya lewat `POST /agent-runs`.
Di AWS, fungsi `jalankan` diganti pemanggilan Bedrock AgentCore Runtime; kontrak endpoint untuk dashboard tetap.
"""

import threading
from datetime import datetime
from typing import Callable
from uuid import uuid4


class AgentSedangBerjalan(Exception):
    pass


def jalankan_agent_lokal(tugas: str, store: int, run_id: str, langkah: list) -> dict:
    # Import di sini supaya Strands dan klien Ollama hanya dimuat saat agent benar-benar dijalankan.
    from agent.run import jalankan
    return jalankan(tugas, store=store, verbose=False, run_id=run_id, langkah=langkah)


class PenjalanAgent:
    def __init__(self, jalankan: Callable[..., dict], clock: Callable[[], datetime]):
        self._jalankan = jalankan
        self._clock = clock
        self._kunci = threading.Lock()
        self._runs: dict[str, dict] = {}

    def mulai(self, tugas: str, store: int) -> dict:
        with self._kunci:
            if any(r["status"] == "BERJALAN" for r in self._runs.values()):
                raise AgentSedangBerjalan
            # Run yang sudah selesai tersimpan di state DB, jadi cukup run terakhir yang disimpan di memori.
            self._runs.clear()
            run = {"run_id": uuid4().hex[:12], "status": "BERJALAN", "tugas": tugas, "store": store,
                   "mulai_pada": self._clock().isoformat(timespec="seconds"), "langkah": [], "pesan": None}
            self._runs[run["run_id"]] = run
        threading.Thread(target=self._kerja, args=(run,), daemon=True).start()
        return self.status(run["run_id"])

    def _kerja(self, run: dict) -> None:
        try:
            hasil = self._jalankan(tugas=run["tugas"], store=run["store"], run_id=run["run_id"],
                                   langkah=run["langkah"])
            run["status"] = "SELESAI" if hasil.get("berhasil") else "GAGAL"
            if not hasil.get("berhasil"):
                run["pesan"] = hasil.get("jawaban")
        except Exception as e:  # misalnya Ollama mati atau API tidak bisa dihubungi
            run["status"], run["pesan"] = "GAGAL", f"Agent gagal dijalankan: {e}"

    def status(self, run_id: str) -> dict | None:
        run = self._runs.get(run_id)
        return None if run is None else {**run, "langkah": list(run["langkah"])}
