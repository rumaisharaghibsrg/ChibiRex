"""Pola pesanan borongan dari Online Retail II (banyak pelanggannya pedagang grosir).

Untuk setiap produk, hari dengan penjualan > rata-rata harian + 3σ ditandai sebagai pesanan borongan.
Besarnya lonjakan (rasio terhadap rata-rata) dipakai untuk menguji guardrail Runaway PO: pesanan
borongan tidak boleh dibaca sebagai tren permanen (proposal Bagian 5).
"""

from pathlib import Path

import duckdb

from engine import config, ingest

FILE = "online_retail_II.csv"
MIN_HARI = 30  # produk dengan riwayat < 30 hari dilewati karena rata-rata dan σ-nya belum stabil


def analisis(con: duckdb.DuckDBPyConnection, csv_path) -> None:
    path = Path(csv_path).as_posix()
    con.execute(f"""
        create or replace table borongan_harian as
        with bersih as (
            -- Buang pembatalan (invoice berawalan C), kuantitas/harga tidak valid, dan kode non-produk
            -- (POST, M, BANK CHARGES, dll.; kode produk diawali 5 digit).
            select StockCode as kode, InvoiceDate::date as tanggal, Quantity as qty
            from read_csv_auto('{path}', sample_size=-1)
            where Invoice not like 'C%' and Quantity > 0 and Price > 0 and regexp_matches(StockCode, '^[0-9]{{5}}')
        ),
        harian as (select kode, tanggal, sum(qty) as qty from bersih group by all),
        hari_buka as (select distinct tanggal from bersih),
        rentang as (select kode, min(tanggal) as awal, max(tanggal) as akhir from harian group by kode),
        seri as (
            select r.kode, h.tanggal, coalesce(j.qty, 0) as qty
            from rentang r
            join hari_buka h on h.tanggal between r.awal and r.akhir
            left join harian j on j.kode = r.kode and j.tanggal = h.tanggal
        ),
        stat as (select kode, avg(qty) as rata, stddev_pop(qty) as sd, count(*) as n_hari from seri group by kode)
        select s.kode, s.tanggal, s.qty, round(st.rata, 2) as rata_harian, round(st.sd, 2) as sd_harian,
            round(s.qty / st.rata, 1) as rasio
        from seri s join stat st using (kode)
        where st.n_hari >= {MIN_HARI} and st.rata > 0 and s.qty > st.rata + 3 * st.sd
    """)
    con.execute(f"""
        create or replace table ringkasan_borongan as
        select
            (select count(distinct StockCode) from read_csv_auto('{path}', sample_size=-1)
             where regexp_matches(StockCode, '^[0-9]{{5}}')) as kode_produk,
            count(distinct kode) as kode_dengan_borongan,
            count(*) as hari_borongan,
            quantile_cont(rasio, 0.5) as rasio_median,
            quantile_cont(rasio, 0.75) as rasio_p75,
            quantile_cont(rasio, 0.9) as rasio_p90
        from borongan_harian
    """)


def build(con: duckdb.DuckDBPyConnection) -> None:
    ingest.download_dataset(config.KAGGLE_ONLINE_RETAIL, config.RAW_ONLINE_RETAIL, [FILE])
    analisis(con, config.RAW_ONLINE_RETAIL / FILE)


if __name__ == "__main__":
    c = duckdb.connect()
    build(c)
    print(c.sql("select * from ringkasan_borongan").df().to_string(index=False))
    print(c.sql("select * from borongan_harian order by rasio desc limit 5").df().to_string(index=False))
