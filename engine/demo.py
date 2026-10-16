"""Pilih pasangan SKU A (Vs naik tajam, perlu reorder) dan SKU B (stagnan, modal tertahan) di toko yang sama."""

import duckdb

from engine import config


def build(con: duckdb.DuckDBPyConnection) -> None:
    con.execute("""
        create or replace table kandidat_demo as
        with a as (
            select *, row_number() over (partition by store order by tren_beli * permintaan_harian desc) as rk
            from sku_metrics
            where status_stok = 'REORDER'
              and tren_beli >= 2
              and beli_jan_sep >= 90  -- basis minimal 10 unit/bulan agar lonjakan tidak berasal dari angka kecil
              and permintaan_harian >= 1
              and hari_aktif = 366
              and data_confidence >= 0.95
        ),
        b as (
            select *, row_number() over (partition by store order by modal_berlebih_idr desc) as rk
            from sku_metrics
            where status_stok in ('OVERSTOCK', 'DEADSTOCK')
              and (tren_beli <= 0.5 or beli_q4 = 0)
              and stok_awal > 0
              and data_confidence >= 0.95
        )
        select
            a.store,
            a.kota,
            a.inventory_id as sku_a,
            a.deskripsi as deskripsi_a,
            a.kategori as kategori_a,
            a.tren_beli as tren_a,
            a.permintaan_harian as permintaan_a,
            a.stok_akhir as stok_a,
            a.reorder_point as rop_a,
            a.saran_qty_po as qty_po_a,
            a.nilai_saran_po_idr as nilai_po_a_idr,
            a.tgl_perkiraan_habis as habis_a,
            b.inventory_id as sku_b,
            b.deskripsi as deskripsi_b,
            b.kategori as kategori_b,
            b.status_stok as status_b,
            b.tren_beli as tren_b,
            b.stok_akhir as stok_b,
            b.hari_cukup as hari_cukup_b,
            b.modal_berlebih_idr as modal_berlebih_b_idr,
            b.modal_berlebih_idr >= a.nilai_saran_po_idr as modal_b_cukup
        from a
        join b on a.store = b.store and a.rk = 1 and b.rk = 1
        order by modal_b_cukup desc, a.tren_beli * a.permintaan_harian desc
        limit 10
    """)


def _rp(x: float | None) -> str:
    return "-" if x is None else f"Rp{x:,.0f}".replace(",", ".")


def _v(x, suffix: str = "") -> str:
    return "-" if x is None else f"{x}{suffix}"


def print_summary(con: duckdb.DuckDBPyConnection) -> None:
    print(f"\nStatus stok per {config.AS_OF}")
    for status, n, nilai in con.execute("""
        select status_stok, count(*), sum(nilai_stok_idr) from sku_metrics group by 1 order by 2 desc
    """).fetchall():
        print(f"  {status:<12} {n:>8,} SKU-toko   nilai stok {_rp(nilai)} (simulasi)")

    rows = con.execute("select * from kandidat_demo limit 3").fetchall()
    cols = [d[0] for d in con.description]
    print("\nKandidat demo (SKU A vs SKU B, toko yang sama):")
    for row in rows:
        r = dict(zip(cols, row))
        print(f"\n  Toko {r['store']} ({r['kota']})")
        print(f"    SKU A {r['sku_a']}: {r['deskripsi_a']} [{r['kategori_a']}]")
        print(f"      tren beli {r['tren_a']}x, laku {r['permintaan_a']}/hari, stok {r['stok_a']} <= ROP {r['rop_a']}, "
              f"perkiraan habis {r['habis_a']}, saran PO {r['qty_po_a']} unit = {_rp(r['nilai_po_a_idr'])}")
        print(f"    SKU B {r['sku_b']}: {r['deskripsi_b']} [{r['kategori_b']}] {r['status_b']}")
        print(f"      tren beli {_v(r['tren_b'], 'x')}, stok {r['stok_b']} (cukup {_v(r['hari_cukup_b'], ' hari')}), "
              f"modal berlebih {_rp(r['modal_berlebih_b_idr'])}, cukup untuk PO A: {r['modal_b_cukup']}")
