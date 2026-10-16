"""Pilih pasangan SKU A dan SKU B di toko yang sama untuk alur demo proposal (Bagian 4):
"lonjakan permintaan SKU A vs stagnasi SKU B → draf PO SKU A → Hold Reorder SKU B → pengalihan modal".

SKU A: Vs naik tajam dan stok sudah di bawah reorder point → agent menyusun draf PO.
SKU B: stok juga di bawah reorder point (sistem statis akan reorder), tetapi Vs turun dan jenisnya tidak
punya peran komplementer → Hold Reorder. Nilai PO yang tidak jadi dibelanjakan dialihkan ke SKU A.
"""

import duckdb

from engine import config

# Syarat yang sama untuk kedua SKU: sudah dijual sejak awal tahun, punya basis volume, data bisa dipercaya.
_DASAR = """
    s.status_stok = 'REORDER'
    and s.hari_aktif = 366
    and s.beli_jan_sep >= 90  -- basis minimal 10 unit/bulan agar tren tidak berasal dari angka kecil
    and s.data_confidence >= 0.95
"""


def build(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"""
        create or replace table kandidat_demo as
        with a as (
            select s.*, bj.jenis, bj.status_komplementer,
                row_number() over (partition by s.store order by s.tren_beli * s.permintaan_harian desc) as rk
            from sku_metrics s left join brand_jenis bj using (brand)
            where {_DASAR}
              and s.tren_beli >= 2
              and s.permintaan_harian >= 1
        ),
        b as (
            select s.*, bj.jenis, bj.status_komplementer,
                row_number() over (partition by s.store order by s.nilai_saran_po_idr desc) as rk
            from sku_metrics s join brand_jenis bj using (brand)
            where {_DASAR}
              and s.tren_beli <= 0.5
              and bj.status_komplementer = 'TIDAK_KOMPLEMENTER'
        )
        select
            a.store,
            a.kota,
            a.inventory_id as sku_a,
            a.deskripsi as deskripsi_a,
            a.jenis as jenis_a,
            a.tren_beli as tren_a,
            a.permintaan_harian as permintaan_a,
            a.stok_akhir as stok_a,
            a.reorder_point as rop_a,
            a.saran_qty_po as qty_po_a,
            a.nilai_saran_po_idr as nilai_po_a_idr,
            a.tgl_perkiraan_habis as habis_a,
            b.inventory_id as sku_b,
            b.deskripsi as deskripsi_b,
            b.jenis as jenis_b,
            b.status_komplementer as status_komplementer_b,
            b.tren_beli as tren_b,
            b.stok_akhir as stok_b,
            b.reorder_point as rop_b,
            b.saran_qty_po as qty_po_b,
            b.nilai_saran_po_idr as modal_diselamatkan_b_idr,
            b.nilai_saran_po_idr >= a.nilai_saran_po_idr as modal_b_cukup
        from a
        join b on a.store = b.store and a.rk = 1 and b.rk = 1
        order by modal_b_cukup desc, a.tren_beli * a.permintaan_harian desc
        limit 10
    """)


def _rp(x: float | None) -> str:
    return "-" if x is None else f"Rp{x:,.0f}".replace(",", ".")


def print_summary(con: duckdb.DuckDBPyConnection) -> None:
    print(f"\nStatus stok per {config.AS_OF}")
    for status, n, nilai in con.execute("""
        select status_stok, count(*), sum(nilai_stok_idr) from sku_metrics group by 1 order by 2 desc
    """).fetchall():
        print(f"  {status:<12} {n:>8,} SKU-toko   nilai stok {_rp(nilai)} (simulasi)")

    print("\nPeran komplementer per jenis (Instacart, lift terhadap order alkohol):")
    for jenis, punya, mitra, lift in con.execute("""
        select jenis, punya_peran_komplementer, mitra_terkuat, lift_alk_terkuat
        from peran_komplementer order by kategori, n_order desc
    """).fetchall():
        keterangan = f"ya (terkuat: {mitra} {lift:.2f}x)" if punya else "tidak"
        print(f"  {jenis:<15} {keterangan}")

    rows = con.execute("select * from kandidat_demo limit 3").fetchall()
    cols = [d[0] for d in con.description]
    print("\nKandidat demo (SKU A vs SKU B, toko yang sama):")
    for row in rows:
        r = dict(zip(cols, row))
        print(f"\n  Toko {r['store']} ({r['kota']})")
        print(f"    SKU A {r['sku_a']}: {r['deskripsi_a']} [{r['jenis_a']}] -> draf PO")
        print(f"      tren beli {r['tren_a']}x, laku {r['permintaan_a']}/hari, stok {r['stok_a']} <= ROP {r['rop_a']}, "
              f"perkiraan habis {r['habis_a']}, saran PO {r['qty_po_a']} unit = {_rp(r['nilai_po_a_idr'])}")
        print(f"    SKU B {r['sku_b']}: {r['deskripsi_b']} [{r['jenis_b']}, {r['status_komplementer_b']}] -> Hold Reorder")
        print(f"      tren beli {r['tren_b']}x, stok {r['stok_b']} <= ROP {r['rop_b']}, PO yang ditahan "
              f"{r['qty_po_b']} unit = {_rp(r['modal_diselamatkan_b_idr'])}, cukup untuk PO A: {r['modal_b_cukup']}")
