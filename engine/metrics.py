"""Metrik vendor, pembelian bulanan, dan tabel utama sku_metrics.

Satu baris sku_metrics = satu SKU (brand) di satu toko, dihitung per tanggal config.AS_OF.
"""

from datetime import date

import duckdb

from engine import config


def build_vendor_metrics(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("""
        create or replace table vendor_metrics as
        with po as (
            select distinct VendorNumber, VendorName, PONumber, PODate, ReceivingDate, PayDate
            from raw_purchases
        ),
        agg as (
            select
                VendorNumber as vendor_number,
                any_value(VendorName) as vendor_name,
                count(distinct PONumber) as jumlah_po,
                avg(datediff('day', PODate, ReceivingDate)) as lead_time_rata,
                coalesce(stddev_samp(datediff('day', PODate, ReceivingDate)), 0) as lead_time_sd,
                avg(datediff('day', ReceivingDate, PayDate)) as hari_bayar
            from po
            group by VendorNumber
        )
        select *,
            -- Proksi performa vendor: 1 − koefisien variasi lead time.
            greatest(0, 1 - lead_time_sd / nullif(lead_time_rata, 0)) as konsistensi_lead_time
        from agg
    """)


def build_monthly_purchases(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("""
        create or replace table beli_bulanan as
        select
            InventoryId as inventory_id,
            date_trunc('month', ReceivingDate)::date as bulan,
            sum(Quantity) as qty,
            sum(Dollars) as dollars_usd
        from raw_purchases
        group by all
    """)


def build_sku_metrics(con: duckdb.DuckDBPyConnection) -> None:
    c = config
    jan_days = (date.fromisoformat(c.JAN_END) - date.fromisoformat(c.JAN_START)).days + 1
    con.execute(f"""
        create or replace table sku_metrics as
        with ids as (
            select InventoryId from raw_beg_inv
            union select InventoryId from raw_end_inv
            union select InventoryId from raw_purchases
        ),
        beli as (
            select
                InventoryId,
                sum(Quantity) as beli_tahun,
                sum(Quantity) filter (where ReceivingDate >= '{c.Q4_START}') as beli_q4,
                sum(Quantity) filter (where ReceivingDate < '{c.Q4_START}') as beli_jan_sep,
                min(ReceivingDate) as terima_pertama,
                arg_max(VendorNumber, ReceivingDate) as vendor_number
            from raw_purchases
            group by InventoryId
        ),
        dasar as (
            select
                ids.InventoryId as inventory_id,
                split_part(ids.InventoryId, '_', 1)::bigint as store,
                split_part(ids.InventoryId, '_', 2) as kota,
                split_part(ids.InventoryId, '_', 3)::bigint as brand,
                pl.Description as deskripsi,
                pl.Size as ukuran,
                case pl.Classification when 1 then 'spirits' when 2 then 'wine' end as kategori,
                coalesce(beli.vendor_number, pl.VendorNumber) as vendor_number,
                coalesce(beg.onHand, 0) as stok_awal,
                coalesce(akhir.onHand, 0) as stok_akhir,
                coalesce(beli.beli_tahun, 0) as beli_tahun,
                coalesce(beli.beli_q4, 0) as beli_q4,
                coalesce(beli.beli_jan_sep, 0) as beli_jan_sep,
                -- SKU aktif sejak 1 Jan kalau punya stok awal, kalau tidak sejak barang pertama diterima.
                greatest({c.MIN_ACTIVE_DAYS}, datediff('day',
                    case when coalesce(beg.onHand, 0) > 0 then date '{c.YEAR_START}'
                         else coalesce(beli.terima_pertama, date '{c.YEAR_START}') end,
                    date '{c.AS_OF}') + 1) as hari_aktif,
                pl.Price as harga_jual_usd,
                pl.PurchasePrice as harga_beli_usd,
                jan.jual_jan,
                jan.iavg_jan,
                jan.stok_min_jan,
                jan.hari_stok_kosong_jan,
                jan.sd_jual_harian_jan / nullif(jan.rata_jual_harian_jan, 0) as cv_jan
            from ids
            left join raw_beg_inv beg on beg.InventoryId = ids.InventoryId
            left join raw_end_inv akhir on akhir.InventoryId = ids.InventoryId
            left join beli on beli.InventoryId = ids.InventoryId
            left join raw_price_list pl on pl.Brand = split_part(ids.InventoryId, '_', 3)::bigint
            left join ringkasan_jan jan on jan.inventory_id = ids.InventoryId
        ),
        cv_kategori as (
            select kategori, median(cv_jan) as cv_median from dasar where cv_jan is not null group by kategori
        ),
        lt_umum as (
            select avg(lead_time_rata) as lt_rata, avg(lead_time_sd) as lt_sd from vendor_metrics
        ),
        permintaan as (
            select
                d.*,
                d.stok_awal + d.beli_tahun - d.stok_akhir as jual_tahun_implisit,
                greatest(d.stok_awal + d.beli_tahun - d.stok_akhir, 0) / d.hari_aktif as permintaan_harian,
                -- Variasi harian diambil dari Januari; SKU tanpa penjualan Januari memakai median kategorinya.
                greatest(d.stok_awal + d.beli_tahun - d.stok_akhir, 0) / d.hari_aktif
                    * coalesce(d.cv_jan, cvk.cv_median, 1.0) as sigma_harian,
                v.vendor_name,
                coalesce(v.lead_time_rata, lt.lt_rata) as lead_time_rata,
                coalesce(v.lead_time_sd, lt.lt_sd) as lead_time_sd,
                v.hari_bayar
            from dasar d
            left join cv_kategori cvk using (kategori)
            left join vendor_metrics v using (vendor_number)
            cross join lt_umum lt
        ),
        ss as (
            select *,
                {c.Z_SERVICE} * sqrt(lead_time_rata * sigma_harian ^ 2
                                     + permintaan_harian ^ 2 * lead_time_sd ^ 2) as safety_stock
            from permintaan
        ),
        rop as (
            select *,
                permintaan_harian * lead_time_rata + safety_stock as reorder_point,
                permintaan_harian * (lead_time_rata + {c.REVIEW_DAYS}) + safety_stock as target_stok,
                stok_akhir / nullif(permintaan_harian, 0) as hari_cukup
            from ss
        ),
        keputusan as (
            select *,
                permintaan_harian > 0 and stok_akhir <= reorder_point as perlu_reorder,
                greatest(0, stok_akhir - target_stok) as kelebihan_unit
            from rop
        )
        select
            inventory_id, store, kota, brand, deskripsi, ukuran, kategori, vendor_number, vendor_name,
            stok_awal, stok_akhir, beli_tahun, beli_q4, beli_jan_sep, jual_jan, jual_tahun_implisit, hari_aktif,

            -- Vs = ΣSt ÷ (n × Iavg)
            round(jual_jan / nullif({jan_days} * iavg_jan, 0), 4) as vs_jan,
            round(case when jual_tahun_implisit >= 0 then
                jual_tahun_implisit / nullif({c.DAYS_IN_YEAR} * (stok_awal + stok_akhir) / 2.0, 0) end, 4) as vs_tahun,
            -- Rata-rata pembelian per bulan Okt–Des dibanding Jan–Sep.
            round((beli_q4 / 3.0) / nullif(beli_jan_sep / 9.0, 0), 2) as tren_beli,

            round(permintaan_harian, 3) as permintaan_harian,
            round(sigma_harian, 3) as sigma_harian,
            round(lead_time_rata, 1) as lead_time_rata,
            round(lead_time_sd, 2) as lead_time_sd,
            round(safety_stock, 1) as safety_stock,
            round(reorder_point, 1) as reorder_point,
            round(target_stok, 1) as target_stok,
            round(hari_cukup, 1) as hari_cukup,
            case when permintaan_harian > 0
                then date '{c.AS_OF}' + floor(hari_cukup)::integer end as tgl_perkiraan_habis,
            perlu_reorder,
            case when perlu_reorder then ceil(target_stok - stok_akhir)::bigint else 0 end as saran_qty_po,
            round(kelebihan_unit, 1) as kelebihan_unit,

            harga_jual_usd,
            harga_beli_usd,
            round(harga_jual_usd - harga_beli_usd, 2) as margin_unit_usd,
            round((harga_jual_usd - harga_beli_usd) / nullif(harga_jual_usd, 0), 3) as margin_pct,
            round(stok_akhir * harga_beli_usd * {c.KURS_USD_IDR}) as nilai_stok_idr,
            round(kelebihan_unit * harga_beli_usd * {c.KURS_USD_IDR}) as modal_berlebih_idr,
            round(case when perlu_reorder then ceil(target_stok - stok_akhir) else 0 end
                  * harga_beli_usd * {c.KURS_USD_IDR}) as nilai_saran_po_idr,
            round(hari_bayar, 1) as hari_bayar_vendor,

            hari_stok_kosong_jan,
            stok_min_jan,
            -- Porsi arus barang yang tidak bisa dijelaskan data: stok rekonstruksi Januari negatif
            -- (terjual tanpa stok tercatat) atau stok akhir lebih besar dari stok awal + pembelian.
            round(1 - least(1, (greatest(0, -coalesce(stok_min_jan, 0)) + greatest(0, -jual_tahun_implisit))
                              / greatest(stok_awal + beli_tahun, 1)), 3) as data_confidence,

            case
                when permintaan_harian = 0 and stok_akhir > 0 then 'DEADSTOCK'
                when perlu_reorder then 'REORDER'
                when hari_cukup > {c.OVERSTOCK_DAYS} then 'OVERSTOCK'
                when stok_akhir = 0 and permintaan_harian = 0 then 'TIDAK_AKTIF'
                else 'AMAN'
            end as status_stok
        from keputusan
    """)


def build(con: duckdb.DuckDBPyConnection) -> None:
    build_vendor_metrics(con)
    build_monthly_purchases(con)
    build_sku_metrics(con)
