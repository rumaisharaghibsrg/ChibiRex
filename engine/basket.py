"""Market Basket Instacart: aturan asosiasi antar-jenis minuman dan peran komplementer per jenis.

Lift dibandingkan terhadap order yang berisi alkohol (lift_alk), bukan semua order. Pembeli alkohol
memang cenderung membeli beberapa jenis alkohol sekaligus, sehingga lift terhadap semua order membuat
setiap jenis terlihat komplementer. Hasilnya dipetakan ke Bibitor lewat jenis minuman (engine/jenis.py).
"""

import duckdb

from engine import config, ingest
from engine.jenis import INSTACART_WINE_AISLE, KATEGORI, SPIRITS, WINE, case_sql

FILES = ["products.csv", "aisles.csv", "departments.csv", "order_products__prior.csv", "order_products__train.csv"]


def download(raw_dir=config.RAW_INSTACART) -> None:
    ingest.download_dataset(config.KAGGLE_INSTACART, raw_dir, FILES)


def load_order_items(con: duckdb.DuckDBPyConnection, raw_dir=config.RAW_INSTACART) -> None:
    """Ubah setiap order menjadi kumpulan item: jenis minuman untuk produk alkohol, nama aisle untuk lainnya."""
    d = raw_dir.as_posix()
    wine_aisle = " ".join(f"when '{aisle}' then '{jenis}'" for aisle, jenis in INSTACART_WINE_AISLE.items())
    con.execute(f"""
        create or replace table item_produk_instacart as
        select
            p.product_id,
            p.product_name,
            case
                when dep.department <> 'alcohol' then a.aisle
                when a.aisle = 'spirits' then {case_sql(SPIRITS, 'p.product_name', 'spirits_lain')}
                when a.aisle = 'beers coolers' then 'beer'
                else case a.aisle {wine_aisle} end
            end as item,
            dep.department = 'alcohol' as alkohol
        from read_csv_auto('{d}/products.csv') p
        join read_csv_auto('{d}/aisles.csv') a using (aisle_id)
        join read_csv_auto('{d}/departments.csv') dep using (department_id)
    """)
    con.execute(f"""
        create or replace temp table order_item as
        select distinct op.order_id, ip.item, ip.alkohol
        from (
            select order_id, product_id from read_csv_auto('{d}/order_products__prior.csv')
            union all
            select order_id, product_id from read_csv_auto('{d}/order_products__train.csv')
        ) op
        join item_produk_instacart ip using (product_id)
    """)


def build_rules(con: duckdb.DuckDBPyConnection) -> None:
    """Aturan X → Y untuk setiap jenis alkohol X, dihitung dari tabel order_item."""
    con.execute("""
        create or replace table aturan_asosiasi as
        with n_order as (
            select count(distinct order_id) as semua,
                   count(distinct order_id) filter (where alkohol) as alkohol
            from order_item
        ),
        order_alkohol as (
            select distinct order_id from order_item where alkohol
        ),
        n_item as (
            select item, any_value(alkohol) as alkohol, count(*) as n_semua from order_item group by item
        ),
        n_item_alk as (
            select item, count(*) as n_alk
            from order_item where order_id in (select order_id from order_alkohol)
            group by item
        ),
        x as (
            select order_id, item from order_item where alkohol and not ends_with(item, '_lain')
        ),
        pasangan as (
            select x.item as antecedent, y.item as consequent, count(*) as n_xy
            from x join order_item y on y.order_id = x.order_id and y.item <> x.item
            group by all
        )
        select
            p.antecedent,
            p.consequent,
            ny.alkohol as consequent_alkohol,
            p.n_xy,
            nx.n_semua as n_x,
            round(p.n_xy / n.semua, 6) as support,
            round(p.n_xy / nx.n_semua, 4) as confidence,
            round((p.n_xy / nx.n_semua) / (ny.n_semua / n.semua), 3) as lift,
            round((p.n_xy / nx.n_semua) / (nya.n_alk / n.alkohol), 3) as lift_alk
        from pasangan p
        join n_item nx on nx.item = p.antecedent
        join n_item ny on ny.item = p.consequent
        join n_item_alk nya on nya.item = p.consequent
        cross join n_order n
    """)


def _mitra_filter(min_lift: float, min_orders: int) -> str:
    return (f"consequent_alkohol and not ends_with(consequent, '_lain') "
            f"and n_xy >= {min_orders} and lift_alk >= {min_lift}")


def build_peran(con: duckdb.DuckDBPyConnection,
                min_lift: float = config.BASKET_MIN_LIFT,
                min_orders: int = config.BASKET_MIN_ORDERS) -> None:
    """Satu baris per jenis: apakah ada jenis lain (mitra) yang dibeli bersamanya jauh lebih sering?"""
    kategori = ", ".join(f"('{j}', '{k}')" for j, k in KATEGORI.items())
    con.execute(f"""
        create or replace table peran_komplementer as
        with jenis as (
            select distinct antecedent as jenis, n_x as n_order from aturan_asosiasi
        ),
        mitra as (
            select antecedent as jenis, consequent as mitra, lift_alk
            from aturan_asosiasi where {_mitra_filter(min_lift, min_orders)}
        ),
        kategori(jenis, kategori) as (values {kategori})
        select
            j.jenis,
            k.kategori,
            j.n_order,
            count(m.mitra) > 0 as punya_peran_komplementer,
            count(m.mitra) as jumlah_mitra,
            arg_max(m.mitra, m.lift_alk) as mitra_terkuat,
            max(m.lift_alk) as lift_alk_terkuat
        from jenis j
        left join mitra m using (jenis)
        left join kategori k using (jenis)
        group by all
    """)


def build_brand_jenis(con: duckdb.DuckDBPyConnection) -> None:
    """Petakan setiap brand Bibitor ke jenis minuman beserta status komplementernya."""
    con.execute(f"""
        create or replace table brand_jenis as
        with b as (
            select
                Brand as brand,
                Description as deskripsi,
                case Classification when 1 then 'spirits' when 2 then 'wine' end as kategori,
                case Classification
                    when 1 then {case_sql(SPIRITS, 'Description', 'spirits_lain')}
                    else {case_sql(WINE, 'Description', 'wine_lain')}
                end as jenis
            from raw_price_list
        )
        select
            b.*,
            case
                when pk.jenis is null then 'TIDAK_DIKETAHUI'
                when pk.punya_peran_komplementer then 'KOMPLEMENTER'
                else 'TIDAK_KOMPLEMENTER'
            end as status_komplementer,
            pk.mitra_terkuat,
            pk.lift_alk_terkuat
        from b
        left join peran_komplementer pk on pk.jenis = b.jenis and not ends_with(b.jenis, '_lain')
    """)


def build(con: duckdb.DuckDBPyConnection) -> None:
    load_order_items(con)
    build_rules(con)
    build_peran(con)
    build_brand_jenis(con)
    con.execute("drop table order_item")


def cek_peran_komplementer(con: duckdb.DuckDBPyConnection, inventory_id: str,
                           min_lift: float = config.BASKET_MIN_LIFT,
                           min_orders: int = config.BASKET_MIN_ORDERS) -> dict:
    """Dasar keputusan Hold Reorder: apakah jenis SKU ini mendorong pembelian jenis minuman lain?

    status TIDAK_DIKETAHUI berarti jenisnya tidak terpetakan, jadi agent tidak boleh hold otomatis.
    """
    row = con.execute("""
        select s.deskripsi, bj.jenis, bj.status_komplementer
        from sku_metrics s left join brand_jenis bj on bj.brand = s.brand
        where s.inventory_id = ?
    """, [inventory_id]).fetchone()
    if row is None:
        raise KeyError(f"SKU {inventory_id} tidak ada di sku_metrics")
    deskripsi, jenis, status = row
    mitra = con.execute(f"""
        select consequent, lift_alk, n_xy from aturan_asosiasi
        where antecedent = ? and {_mitra_filter(min_lift, min_orders)}
        order by lift_alk desc limit 3
    """, [jenis]).fetchall()
    return {
        "inventory_id": inventory_id,
        "deskripsi": deskripsi,
        "jenis": jenis,
        "status": status or "TIDAK_DIKETAHUI",
        "mitra": [{"jenis": j, "lift_alk": lift, "order_bersama": n} for j, lift, n in mitra],
    }
