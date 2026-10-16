"""Jalankan seluruh pipeline Tahap 2–3: `python -m engine.pipeline`."""

import time

import duckdb

from engine import basket, config, demo, ingest, metrics, stock

STEPS = [
    ("Muat CSV ke DuckDB", ingest.load),
    ("Rekonstruksi stok harian Januari", stock.build),
    ("Metrik vendor & sku_metrics", metrics.build),
    ("Market Basket Instacart & peran komplementer", basket.build),
    ("Pilih kandidat SKU A & B", demo.build),
]


def main() -> None:
    ingest.download()
    basket.download()
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with duckdb.connect(str(config.DB_PATH)) as con:
        for label, step in STEPS:
            t0 = time.perf_counter()
            step(con)
            print(f"[ok] {label} ({time.perf_counter() - t0:.1f} dtk)")
        n = con.execute("select count(*) from sku_metrics").fetchone()[0]
        print(f"\nsku_metrics: {n:,} baris -> {config.DB_PATH}")
        demo.print_summary(con)


if __name__ == "__main__":
    main()
