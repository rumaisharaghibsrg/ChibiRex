"""Predictive Stockout Alert: model risiko stok habis dilatih di Product Backorders, lalu dipakai ke Bibitor.

Datanya beda domain (suku cadang vs minuman) dan beda skala, jadi model hanya memakai fitur rasio yang
tidak bergantung skala (berapa bulan stok cukup, tren penjualan, barang dalam perjalanan relatif terhadap
ramalan). Skornya ditampilkan sebagai model pra-latih yang indikatif; kalibrasi ulang di pilot Fase 2.

Latih ulang paksa: `python -m engine.risiko --latih`.
"""

import json
import sys
from datetime import datetime

import duckdb
import lightgbm as lgb
import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score

from engine import config, ingest

FITUR = ["cover_forecast_bulan", "cover_jual_bulan", "stok_habis", "ada_forecast", "transit_per_forecast",
         "tren_jual_1v3", "tren_jual_3v9", "forecast_per_jual", "lead_time_minggu"]
BATAS_RASIO = 24  # rasio dibatasi supaya nilai ekstrem (misalnya stok untuk 500 bulan) tidak mendominasi


def sql_fitur(sumber: str) -> str:
    """Fitur yang sama untuk Backorders dan Bibitor. `sumber` wajib punya kolom bernama seperti Backorders."""
    def rasio(atas: str, bawah: str) -> str:
        # Penyebut nol -> NULL (LightGBM menanganinya sebagai data kosong). least() saja tidak cukup,
        # karena least() di DuckDB mengabaikan NULL sehingga 0/0 malah menjadi nilai batas.
        return f"case when ({bawah}) > 0 then least(({atas}) / ({bawah}), {BATAS_RASIO}) end"
    return f"""
        select *,
            {rasio('greatest(national_inv, 0)', 'forecast_3_month / 3.0')} as cover_forecast_bulan,
            {rasio('greatest(national_inv, 0)', 'sales_3_month / 3.0')} as cover_jual_bulan,
            (national_inv <= 0)::int as stok_habis,
            (forecast_3_month > 0)::int as ada_forecast,
            {rasio('in_transit_qty', 'forecast_3_month')} as transit_per_forecast,
            {rasio('sales_1_month * 3.0', 'sales_3_month')} as tren_jual_1v3,
            {rasio('sales_3_month * 3.0', 'sales_9_month')} as tren_jual_3v9,
            {rasio('forecast_3_month', 'sales_3_month')} as forecast_per_jual,
            lead_time as lead_time_minggu
        from {sumber}
    """


def _backorders(con: duckdb.DuckDBPyConnection, bagian: str):
    path = (config.RAW_BACKORDERS / f"Back_order_{bagian}.csv").as_posix()
    # File diakhiri baris penutup "(1687860 rows)" sisa ekspor database; ignore_errors membuangnya.
    sumber = f"""(select * from read_csv('{path}', header=true, delim=',', quote='"', ignore_errors=true,
                                         sample_size=-1) where sku is not null)"""
    df = con.sql(f"select {', '.join(FITUR)}, went_on_backorder::int as y from ({sql_fitur(sumber)})").df()
    return df[FITUR], df["y"].to_numpy()


def latih(con: duckdb.DuckDBPyConnection) -> dict:
    X, y = _backorders(con, "train")
    X_test, y_test = _backorders(con, "test")
    rng = np.random.default_rng(42)
    val = rng.random(len(y)) < 0.1
    params = {"objective": "binary", "learning_rate": 0.05, "num_leaves": 63, "min_child_samples": 200,
              "feature_fraction": 0.9, "bagging_fraction": 0.8, "bagging_freq": 1, "seed": 42, "verbose": -1}
    # Tanpa pembobotan kelas, supaya probabilitasnya tetap terkalibrasi dan bisa dibaca sebagai Confidence Score.
    model = lgb.train(params, lgb.Dataset(X[~val], y[~val]), num_boost_round=2000,
                      valid_sets=[lgb.Dataset(X[val], y[val])], callbacks=[lgb.early_stopping(50, verbose=False)])
    p = model.predict(X_test, num_iteration=model.best_iteration)

    # Pembanding sederhana: urutkan dari stok paling sedikit relatif terhadap ramalan.
    dasar = -np.nan_to_num(X_test["cover_forecast_bulan"].to_numpy(), nan=BATAS_RASIO)
    desil = np.argsort(np.argsort(p)) * 10 // len(p)
    metrik = {
        "dilatih_pada": datetime.now().isoformat(timespec="seconds"),
        "baris_train": int(len(y)), "baris_test": int(len(y_test)),
        "porsi_backorder_test": round(float(y_test.mean()), 5),
        "pr_auc": round(float(average_precision_score(y_test, p)), 4),
        "roc_auc": round(float(roc_auc_score(y_test, p)), 4),
        "pr_auc_aturan_cover": round(float(average_precision_score(y_test, dasar)), 4),
        "roc_auc_aturan_cover": round(float(roc_auc_score(y_test, dasar)), 4),
        "iterasi": int(model.best_iteration),
        "kalibrasi_desil": [{"desil": int(d), "rata_prediksi": round(float(p[desil == d].mean()), 4),
                             "porsi_aktual": round(float(y_test[desil == d].mean()), 4)} for d in range(10)],
        "fitur": FITUR,
    }
    config.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model.save_model(str(config.MODEL_RISIKO), num_iteration=model.best_iteration)
    config.MODEL_RISIKO_METRIK.write_text(json.dumps(metrik, indent=2), encoding="utf-8")
    return metrik


def skor_bibitor(con: duckdb.DuckDBPyConnection) -> None:
    """Hitung fitur yang sama dari Bibitor per 31 Des 2016, lalu beri skor risiko per SKU per toko."""
    model = lgb.Booster(model_file=str(config.MODEL_RISIKO))
    # Padanan fitur: penjualan bulanan diproksikan dengan pembelian bulanan (rasio jual/beli Januari 1,02),
    # ramalan 3 bulan = laju harian x 91 hari, lead time hari -> minggu, barang dalam perjalanan = 0
    # (per 31 Des semua PO Bibitor sudah diterima).
    sumber = f"""(
        with beli as (
            select inventory_id,
                sum(qty) filter (where bulan = date '2016-12-01') as s1,
                sum(qty) filter (where bulan >= date '{config.Q4_START}') as s3,
                sum(qty) filter (where bulan >= date '2016-04-01') as s9
            from beli_bulanan group by inventory_id
        )
        select s.inventory_id, s.stok_akhir as national_inv, 0 as in_transit_qty,
            s.permintaan_harian * 91 as forecast_3_month, coalesce(b.s1, 0) as sales_1_month,
            coalesce(b.s3, 0) as sales_3_month, coalesce(b.s9, 0) as sales_9_month,
            s.lead_time_rata / 7.0 as lead_time
        from sku_metrics s left join beli b using (inventory_id)
    )"""
    df = con.sql(f"select inventory_id, {', '.join(FITUR)} from ({sql_fitur(sumber)})").df()
    df["risiko_stockout"] = np.round(model.predict(df[FITUR]), 4)
    # Probabilitas mentah tidak terkalibrasi untuk domain Bibitor (beda industri, beda porsi kasus), tetapi
    # urutannya bisa dipercaya (ROC-AUC 0,93 di data test). Karena itu Confidence Score = peringkat 0-100
    # di antara SKU yang masih laku: TINGGI = 10% teratas, SEDANG = 20% berikutnya.
    con.execute(f"""
        create or replace table risiko_stockout as
        with d as (
            select d.inventory_id, d.risiko_stockout, d.cover_forecast_bulan, d.tren_jual_1v3,
                s.permintaan_harian > 0 as laku
            from df d join sku_metrics s using (inventory_id)
        ),
        skor as (
            select *, case when laku then round(100 * percent_rank() over (partition by laku order by risiko_stockout))
                           else 0 end::integer as skor_risiko
            from d
        )
        select inventory_id, risiko_stockout, skor_risiko,
            case when skor_risiko >= {config.RISIKO_TINGGI} then 'TINGGI'
                 when skor_risiko >= {config.RISIKO_SEDANG} then 'SEDANG' else 'RENDAH' end as level_risiko,
            cover_forecast_bulan, tren_jual_1v3
        from skor
    """)


def build(con: duckdb.DuckDBPyConnection, paksa_latih: bool = False) -> None:
    ingest.download_dataset(config.KAGGLE_BACKORDERS, config.RAW_BACKORDERS,
                            ["Back_order_train.csv", "Back_order_test.csv"])
    if paksa_latih or not config.MODEL_RISIKO.exists():
        m = latih(duckdb.connect())
        print(f"     model dilatih: PR-AUC {m['pr_auc']} (aturan cover {m['pr_auc_aturan_cover']}), "
              f"ROC-AUC {m['roc_auc']}, porsi backorder {m['porsi_backorder_test']}")
    skor_bibitor(con)


if __name__ == "__main__":
    with duckdb.connect(str(config.DB_PATH)) as c:
        build(c, paksa_latih="--latih" in sys.argv)
        print(c.sql("select count(*) n, round(avg(risiko_stockout), 4) rata from risiko_stockout").fetchall())
