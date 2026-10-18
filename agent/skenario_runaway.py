"""Skenario uji Runaway PO: `python -m agent.skenario_runaway --store 74` (API harus sudah berjalan).

Meniru sistem naif yang membaca satu hari pesanan borongan sebagai tren permanen: jumlah PO dikalikan
lonjakan borongan tipikal dari data grosir nyata (Online Retail II, median rasio hari > 3σ). Yang
diharapkan: guardrail 3σ dan batas harian menahan PO, circuit breaker terbuka setelah 3 PO ditahan,
lalu PO normal pun ikut ditahan sampai manajer mereset.
"""

import argparse
import math
from uuid import uuid4

import duckdb
import httpx

from agent import config as agent_config
from engine import config
from engine.format import angka

PEMBUAT = "skenario uji Runaway PO"


def rasio_borongan() -> float:
    with duckdb.connect(str(config.DB_PATH), read_only=True) as con:
        return con.execute("select rasio_median from ringkasan_borongan").fetchone()[0]


def _po(client: httpx.Client, inventory_id: str, qty: int | None, alasan: str) -> dict:
    body = {"inventory_id": inventory_id, "alasan": alasan, "dibuat_oleh": PEMBUAT}
    if qty is not None:
        body["qty"] = qty
    r = client.post("/purchase-orders", json=body, headers={"Idempotency-Key": f"skenario-{uuid4().hex[:16]}"})
    r.raise_for_status()
    return r.json()


def _kode(po: dict) -> str:
    return ", ".join(p["kode"] for p in po["pelanggaran"]) or "-"


def jalankan(client: httpx.Client, store: int, rasio: float, reset: bool = True, cetak=print) -> dict:
    if client.get("/guardrails/status").json()["circuit_breaker_terbuka"]:
        raise RuntimeError("Circuit breaker sudah terbuka. Reset dulu lewat POST /guardrails/circuit-breaker/reset.")
    naik = client.get(f"/stores/{store}/prioritas", params={"limit_naik": 10, "limit_turun": 0}).json()["naik"]
    if not naik:
        raise RuntimeError(f"Tidak ada SKU 'naik' di toko {store}.")
    draf = {p["inventory_id"] for p in client.get("/purchase-orders", params={"status": "DRAFT", "store": store}).json()}
    kandidat = [s for s in naik if s["inventory_id"] not in draf] or naik

    cetak(f"Lonjakan borongan tipikal di data grosir (Online Retail II): {angka(rasio)}x rata-rata harian.")
    cetak("Sistem naif membaca lonjakan itu sebagai tren permanen dan memperbesar PO:")
    hasil = []
    for i in range(3):
        sku = kandidat[i % len(kandidat)]
        qty = min(math.ceil(sku["saran_qty_po"] * rasio), 100_000)
        po = _po(client, sku["inventory_id"], qty,
                 f"Simulasi sistem naif: lonjakan borongan {angka(rasio)}x dibaca sebagai tren permanen")
        hasil.append(po)
        cetak(f"  {sku['deskripsi']}: {qty} unit (normal {sku['saran_qty_po']}) -> {po['status']} [{_kode(po)}]")

    breaker = client.get("/guardrails/status").json()
    cetak(f"Circuit breaker terbuka: {breaker['circuit_breaker_terbuka']} ({breaker['alasan']})")

    sku = kandidat[3 % len(kandidat)]
    po = _po(client, sku["inventory_id"], None, "PO normal sesuai saran sistem")
    hasil.append(po)
    cetak(f"PO normal setelah itu, {sku['deskripsi']}: {po['qty']} unit -> {po['status']} [{_kode(po)}]")

    if reset:
        client.post("/guardrails/circuit-breaker/reset",
                    json={"oleh": "manajer (akhir skenario uji)", "catatan": "Skenario uji Runaway PO selesai"})
        cetak("Circuit breaker direset oleh manajer; sistem kembali normal.")
    return {"rasio": rasio, "po": hasil, "breaker": breaker}


def main() -> None:
    p = argparse.ArgumentParser(description="Skenario uji guardrail Runaway PO.")
    p.add_argument("--store", type=int, default=74)
    p.add_argument("--rasio", type=float, help="Lonjakan borongan (default: median dari Online Retail II).")
    p.add_argument("--biarkan-terbuka", action="store_true", help="Jangan reset circuit breaker di akhir.")
    args = p.parse_args()
    with httpx.Client(base_url=agent_config.API_URL, timeout=30) as client:
        jalankan(client, args.store, args.rasio or rasio_borongan(), reset=not args.biarkan_terbuka)


if __name__ == "__main__":
    main()
