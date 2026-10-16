"""Rekonstruksi stok harian Januari 2016: stok awal + barang diterima − barang terjual.

Hanya Januari yang punya data penjualan harian lengkap (lihat config.JAN_START).
"""

import duckdb

from engine import config


def build(con: duckdb.DuckDBPyConnection) -> None:
    start, end = config.JAN_START, config.JAN_END
    con.execute(f"""
        create or replace table stok_harian_jan as
        with toko as (
            select distinct Store from raw_sales where SalesDate between '{start}' and '{end}'
        ),
        sku as (
            select InventoryId from raw_beg_inv where Store in (select Store from toko)
            union
            select InventoryId from raw_sales where SalesDate between '{start}' and '{end}'
            union
            select InventoryId from raw_purchases
            where ReceivingDate between '{start}' and '{end}' and Store in (select Store from toko)
        ),
        hari as (
            select range::date as tanggal from range(date '{start}', date '{end}' + 1, interval 1 day)
        ),
        masuk as (
            select InventoryId, ReceivingDate as tanggal, sum(Quantity) as qty
            from raw_purchases where ReceivingDate between '{start}' and '{end}' group by all
        ),
        keluar as (
            select InventoryId, SalesDate as tanggal, sum(SalesQuantity) as qty
            from raw_sales where SalesDate between '{start}' and '{end}' group by all
        )
        select
            sku.InventoryId as inventory_id,
            hari.tanggal,
            coalesce(masuk.qty, 0) as masuk,
            coalesce(keluar.qty, 0) as terjual,
            coalesce(beg.onHand, 0)
                + sum(coalesce(masuk.qty, 0) - coalesce(keluar.qty, 0))
                  over (partition by sku.InventoryId order by hari.tanggal) as stok_akhir_hari
        from sku
        cross join hari
        left join masuk on masuk.InventoryId = sku.InventoryId and masuk.tanggal = hari.tanggal
        left join keluar on keluar.InventoryId = sku.InventoryId and keluar.tanggal = hari.tanggal
        left join raw_beg_inv beg on beg.InventoryId = sku.InventoryId
    """)

    # Stok negatif berarti terjual lebih banyak dari stok yang tercatat: tanda data stok tidak akurat.
    con.execute("""
        create or replace table ringkasan_jan as
        select
            inventory_id,
            sum(terjual) as jual_jan,
            avg(terjual) as rata_jual_harian_jan,
            stddev_pop(terjual) as sd_jual_harian_jan,
            avg(greatest(stok_akhir_hari, 0)) as iavg_jan,
            min(stok_akhir_hari) as stok_min_jan,
            count(*) filter (where stok_akhir_hari <= 0) as hari_stok_kosong_jan
        from stok_harian_jan
        group by inventory_id
    """)
