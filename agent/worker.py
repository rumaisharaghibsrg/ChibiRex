"""Worker agent di laptop: `python -m agent.worker` (berhenti dengan Ctrl+C).

Dipakai saat API berjalan di AWS Lambda (mode antrian) tetapi LLM berjalan di laptop lewat Ollama. Tombol
"Jalankan Agent" di dashboard menaruh tugas ke antrian API; worker ini mengambilnya, menjalankan agent Strands,
dan melaporkan setiap pemanggilan tool ke API, sehingga dashboard menampilkan langkah agent selagi bekerja.
Semua aksi agent tetap lewat API di Lambda, jadi guardrail dan tiruan SAP tetap berjalan di AWS.

Atur di .env: CHIBIREX_WORKER_API_URL (URL Lambda) dan CHIBIREX_WORKER_TOKEN (sama dengan di Lambda).
"""

import argparse
import socket
import time

import httpx

from agent import config
from agent.llm import nama_model
from agent.run import jalankan


class LangkahTerlapor(list):
    """Daftar langkah agent yang juga dikirim ke API setiap kali agent memanggil tool."""

    def __init__(self, client: httpx.Client, run_id: str):
        super().__init__()
        self.client = client
        self.run_id = run_id

    def append(self, langkah: dict) -> None:
        super().append(langkah)
        try:
            self.client.post(f"/agent-runs/{self.run_id}/langkah", json=langkah).raise_for_status()
        except httpx.HTTPError as e:  # agent tetap jalan; jejak lengkap tetap dikirim di akhir
            print(f"  [peringatan] langkah gagal dilaporkan ke API: {e}")


def ambil_tugas(client: httpx.Client, nama: str) -> dict | None:
    r = client.post("/agent-runs/antrian/ambil", params={"nama": nama})
    if r.status_code == 204:
        return None
    if r.status_code == 401:
        raise SystemExit("Token worker ditolak API. Samakan CHIBIREX_WORKER_TOKEN di .env dengan yang di Lambda.")
    r.raise_for_status()
    return r.json()


def main() -> None:
    p = argparse.ArgumentParser(description="Worker agent: ambil tugas dari antrian API dan jalankan dengan LLM lokal.")
    p.add_argument("--jeda", type=float, default=2.0, help="Detik antara pengecekan antrian (default 2)")
    p.add_argument("--sekali", action="store_true", help="Berhenti setelah satu tugas selesai")
    args = p.parse_args()
    nama = socket.gethostname()

    with httpx.Client(base_url=config.WORKER_API_URL, timeout=60, headers=config.header_worker()) as client:
        print(f"Worker agent aktif di {nama} | {nama_model()}\nAPI: {config.WORKER_API_URL}\n"
              "Menunggu tugas dari tombol 'Jalankan Agent' di dashboard... (Ctrl+C untuk berhenti)")
        while True:
            try:
                tugas = ambil_tugas(client, nama)
            except httpx.HTTPError as e:
                print(f"API tidak bisa dihubungi ({e}); mencoba lagi dalam 5 detik.")
                time.sleep(5)
                continue
            if tugas is None:
                time.sleep(args.jeda)
                continue
            print(f"\nTugas {tugas['run_id']} (toko {tugas['store']}): {tugas['tugas']}")
            try:
                jalankan(tugas["tugas"], store=tugas["store"], client=client, verbose=True, run_id=tugas["run_id"],
                         langkah=LangkahTerlapor(client, tugas["run_id"]))
            except httpx.HTTPError as e:  # API kambuh saat menyimpan jejak; API menandai tugasnya GAGAL sendiri
                print(f"Jejak agent gagal disimpan ke API: {e}")
            if args.sekali:
                break
            print("\nMenunggu tugas berikutnya...")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nWorker dihentikan.")
