"""Jam simulasi: data Bibitor berhenti di 31 Des 2016 (`config.AS_OF`), jadi waktu dimajukan dari tanggal itu,
lewat tombol di dashboard (`POST /simulasi/maju`) atau otomatis berkala (`POST /simulasi/otomatis`).

Setiap hari simulasi, stok SKU berkurang mengikuti permintaan harian dari data (acak tetapi deterministik per SKU per
hari, jadi semua orang melihat angka yang sama), dan barang dari PO yang disetujui serta stok uji Hold Reorder tiba
setelah lead time vendor. Status stok, saran PO, Health Score, dan prioritas agent ikut berubah.

Hasilnya dibuat sebagai tabel sementara bernama `sku_metrics` di cursor DuckDB satu request. Tabel sementara menutupi
tabel asli yang bernama sama, sehingga semua query yang sudah ada otomatis membaca stok hari simulasi tanpa diubah,
sedangkan file DuckDB (hanya baca) dan request lain tidak tersentuh.
"""

from datetime import date, datetime, timedelta

from api import state
from api.settings import Settings
from engine import config

TANGGAL_AWAL = date.fromisoformat(config.AS_OF)

SIM_SQL = """
create or replace temp table sku_metrics as
with dasar as (
    select *, ln(1 + (sigma_harian / nullif(permintaan_harian, 0)) ^ 2) as _v
    from {asli} where {lingkup}
),
tiba as (
    select inventory_id, hari, sum(qty) as qty
    from (select unnest(?::varchar[]) as inventory_id, unnest(?::integer[]) as hari, unnest(?::bigint[]) as qty)
    group by all
),
-- Satu baris per SKU per hari; `acak` memberi tiga angka acak 20-bit yang selalu sama untuk SKU dan hari itu.
harian as (
    select d.inventory_id, t.hari, d.permintaan_harian as mu, d._v, hash(d.inventory_id || '|' || t.hari) as acak
    from dasar d cross join range(1, ? + 1) t(hari)
    where d.permintaan_harian > 0 or d.inventory_id in (select inventory_id from tiba)
),
-- Permintaan harian lognormal dengan rata-rata permintaan_harian dan simpangan sigma_harian (Box-Muller),
-- dibulatkan secara acak supaya SKU yang lambat tetap sesekali terjual.
arus as (
    select h.inventory_id, h.hari,
        coalesce(ti.qty, 0) - case when h.mu > 0 then floor(
            exp(ln(h.mu) - h._v / 2 + sqrt(h._v)
                * sqrt(-2 * ln(((h.acak & 1048575) + 0.5) / 1048576))
                * cos(2 * pi() * (((h.acak >> 20) & 1048575) + 0.5) / 1048576))
            + (((h.acak >> 40) & 1048575) + 0.5) / 1048576) else 0 end as bersih
    from harian h left join tiba ti using (inventory_id, hari)
),
kumulatif as (
    select inventory_id, hari, sum(bersih) over (partition by inventory_id order by hari) as kum from arus
),
-- Stok tidak bisa negatif; permintaan saat stok habis hilang (lost sales). Rumus Lindley:
-- stok hari n = X(n) - min(0, min X(k)), dengan X(k) = stok awal + arus bersih kumulatif sampai hari k.
gerak as (
    select inventory_id, arg_max(kum, hari) as kum_akhir, min(kum) as kum_min from kumulatif group by inventory_id
),
jalan as (
    select inventory_id, sum(qty) as qty from tiba where hari > ? group by all
),
posisi as (
    select d.* exclude (_v),
        (d.stok_akhir + coalesce(g.kum_akhir, 0) - least(0, d.stok_akhir + coalesce(g.kum_min, 0)))::bigint as _stok,
        coalesce(j.qty, 0)::bigint as stok_dalam_pengiriman
    from dasar d left join gerak g using (inventory_id) left join jalan j using (inventory_id)
),
-- Aturan sama dengan engine/metrics.py; reorder memakai posisi stok (di gudang + dalam pengiriman), supaya SKU yang
-- PO-nya sudah disetujui tidak dipesan ulang selagi barangnya di jalan. SKU yang stoknya tidak bergerak (`_tetap`)
-- memakai nilai asli pipeline, karena kolom tersimpan sudah dibulatkan dan hitung ulang bisa bergeser di batas ROP.
keputusan as (
    select *,
        permintaan_harian > 0 and _stok + stok_dalam_pengiriman <= reorder_point as _perlu,
        _stok = stok_akhir and stok_dalam_pengiriman = 0 as _tetap
    from posisi
)
select * exclude (_stok, _perlu, _tetap) replace (
    _stok as stok_akhir,
    case when _tetap then hari_cukup else round(_stok / nullif(permintaan_harian, 0), 1) end as hari_cukup,
    case when _tetap then tgl_perkiraan_habis when permintaan_harian > 0
        then date '{as_of}' + ? + floor(_stok / permintaan_harian)::integer end as tgl_perkiraan_habis,
    case when _tetap then perlu_reorder else _perlu end as perlu_reorder,
    case when _tetap then saran_qty_po when _perlu
        then ceil(target_stok - _stok - stok_dalam_pengiriman)::bigint else 0 end as saran_qty_po,
    case when _tetap then kelebihan_unit else round(greatest(0, _stok - target_stok), 1) end as kelebihan_unit,
    case when _tetap then nilai_stok_idr else round(_stok * harga_beli_usd * {kurs}) end as nilai_stok_idr,
    case when _tetap then modal_berlebih_idr
        else round(greatest(0, _stok - target_stok) * harga_beli_usd * {kurs}) end as modal_berlebih_idr,
    case when _tetap then nilai_saran_po_idr
        else round(case when _perlu then ceil(target_stok - _stok - stok_dalam_pengiriman) else 0 end
                   * harga_beli_usd * {kurs}) end as nilai_saran_po_idr,
    case
        when _tetap then status_stok
        when permintaan_harian = 0 and _stok > 0 then 'DEADSTOCK'
        when _perlu then 'REORDER'
        when _stok / nullif(permintaan_harian, 0) > {overstock} then 'OVERSTOCK'
        when _stok = 0 and permintaan_harian = 0 then 'TIDAK_AKTIF'
        else 'AMAN'
    end as status_stok
)
from keputusan
"""


def tanggal(hari: int) -> date:
    return TANGGAL_AWAL + timedelta(days=hari)


def _hari(row, sekarang: datetime, hari_maks: int) -> int:
    hari = row["hari_ke"]
    if row["otomatis"] and row["acuan"]:
        berlalu = (sekarang - datetime.fromisoformat(row["acuan"])).total_seconds()
        hari += int(berlalu // row["detik_per_hari"])
    return min(max(hari, 0), hari_maks)


def status(con, s: Settings, sekarang: datetime) -> dict:
    row = con.execute("select * from simulasi where id = 1").fetchone()
    hari = _hari(row, sekarang, s.simulasi_hari_maks)
    return {"hari_ke": hari, "tanggal": tanggal(hari), "otomatis": bool(row["otomatis"]),
            "detik_per_hari": row["detik_per_hari"], "hari_maks": s.simulasi_hari_maks}


def hari_ini(con, s: Settings, sekarang: datetime) -> int:
    return status(con, s, sekarang)["hari_ke"]


def atur(con, s: Settings, sekarang: datetime, *, hari: int | None = None, otomatis: bool | None = None,
         detik_per_hari: float | None = None) -> dict:
    """Ubah jam simulasi. Hari efektif saat ini disimpan sebagai acuan baru, supaya mode otomatis tidak melompat."""
    row = con.execute("select * from simulasi where id = 1").fetchone()
    kini = _hari(row, sekarang, s.simulasi_hari_maks)
    con.execute("update simulasi set hari_ke = ?, otomatis = ?, detik_per_hari = ?, acuan = ? where id = 1",
                (min(kini if hari is None else hari, s.simulasi_hari_maks),
                 int(row["otomatis"] if otomatis is None else otomatis),
                 detik_per_hari or row["detik_per_hari"], sekarang.isoformat(timespec="seconds")))
    return status(con, s, sekarang)


def kedatangan(con, store: int | None, inventory_id: str | None) -> list[tuple[str, int, int]]:
    """Barang yang dipesan: PO yang disetujui dan stok uji Hold Reorder aktif, sebagai (inventory_id, hari tiba, qty)."""
    lingkup, params = "", []
    if inventory_id is not None:
        lingkup, params = " and inventory_id = ?", [inventory_id]
    elif store is not None:
        lingkup, params = " and store = ?", [store]
    return [tuple(r) for r in con.execute(
        f"""select inventory_id, hari_tiba, qty from purchase_orders
            where status = 'APPROVED' and hari_tiba is not null{lingkup}
            union all
            select inventory_id, hari_tiba, qty_uji from holds
            where status = 'AKTIF' and hari_tiba is not null{lingkup}""", params + params)]


def terapkan(cur, s: Settings, *, store: int | None = None, inventory_id: str | None = None) -> int:
    """Buat tabel sementara `sku_metrics` di cursor ini untuk hari simulasi sekarang, terbatas pada satu toko atau
    satu SKU supaya ringan. Mengembalikan hari simulasi. Hari 0 tanpa barang dipesan memakai data asli apa adanya."""
    with state.baca(s.state_db) as con:
        hari = hari_ini(con, s, s.clock())
        tiba = kedatangan(con, store, inventory_id)
    if hari == 0 and not tiba:
        return 0
    if inventory_id is not None:
        lingkup, params = "inventory_id = ?", [inventory_id]
    elif store is not None:
        lingkup, params = "store = ?", [store]
    else:
        lingkup, params = "true", []
    db = cur.execute("select current_database()").fetchone()[0]
    sql = SIM_SQL.format(asli=f'"{db}".main.sku_metrics', lingkup=lingkup, as_of=config.AS_OF,
                         kurs=config.KURS_USD_IDR, overstock=config.OVERSTOCK_DAYS)
    ids, hari_tiba, qty = ([list(k) for k in zip(*tiba)] if tiba else ([], [], []))
    cur.execute(sql, params + [ids, hari_tiba, qty, hari, hari, hari])
    return hari
