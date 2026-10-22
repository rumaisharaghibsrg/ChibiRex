"""Kosongkan data demo: `python -m agent.reset_demo` (API online, sesuai CHIBIREX_WORKER_API_URL di .env) atau
`python -m agent.reset_demo --lokal` (API di laptop). Menghapus PO, hold, hitung fisik, jejak agent, audit log,
dan PO di tiruan SAP, lalu menutup circuit breaker. Jalankan sebelum gladi atau presentasi.
"""

import argparse

import httpx

from agent import config


def main() -> None:
    p = argparse.ArgumentParser(description="Kosongkan data transaksi demo di API Rexa.")
    p.add_argument("--lokal", action="store_true", help=f"Pakai API laptop ({config.API_URL})")
    p.add_argument("--ya", action="store_true", help="Lewati konfirmasi")
    args = p.parse_args()
    api_url = config.API_URL if args.lokal else config.WORKER_API_URL

    if not args.ya and input(f"Hapus semua data demo di {api_url}? Ketik 'ya': ").strip().lower() != "ya":
        print("Dibatalkan.")
        return
    with httpx.Client(base_url=api_url, timeout=60, headers=config.header_worker()) as client:
        r = client.post("/demo/reset")
        if r.status_code == 401:
            raise SystemExit("Token ditolak. Samakan CHIBIREX_WORKER_TOKEN di .env dengan yang di Lambda.")
        r.raise_for_status()
    print("Data demo dikosongkan. Nomor PO SAP berikutnya kembali 4500000001.")


if __name__ == "__main__":
    main()
