"""Uji pemetaan jenis minuman dan aturan asosiasi dengan data sintetis kecil."""

import duckdb
import pytest

from engine import basket
from engine.jenis import SPIRITS, WINE, case_sql


@pytest.mark.parametrize("nama, kelas, jenis", [
    ("Patron Reposado Tequila", 1, "tequila"),
    ("Bacardi Gold Rum", 1, "rum"),
    ("Smirnoff 80 Proof", 1, "vodka"),
    ("Jack Daniels No 7 Black", 1, "whiskey"),
    ("Rumpleminze", 1, "liqueur"),  # mengandung "rum" tapi bukan rum
    ("Hennessy XO Cognac", 1, "brandy"),
    ("Kendall Jackson Chard Vt RSV", 2, "wine_white"),
    ("3 Blind Moose Cab Svgn Cal", 2, "wine_red"),  # Cabernet Sauvignon = red, bukan white
    ("Andre Extra Dry", 2, "wine_sparkling"),
    ("Mystery Brand", 1, "spirits_lain"),
])
def test_pemetaan_jenis(nama, kelas, jenis):
    rules, fallback = (SPIRITS, "spirits_lain") if kelas == 1 else (WINE, "wine_lain")
    hasil = duckdb.execute(f"select {case_sql(rules, 'nama', fallback)} from (select ? as nama)", [nama]).fetchone()[0]
    assert hasil == jenis


# 7 order berisi alkohol + 3 order tanpa alkohol.
# tequila (3 order) dibeli bersama rum di 2 order; rum ada di 3 dari 7 order alkohol.
#   lift_alk = (2/3) / (3/7) = 1,556 -> komplementer.
# wine_red (2 order) dibeli bersama wine_white di 1 order; wine_white ada di 3 dari 7 order alkohol.
#   lift_alk = (1/2) / (3/7) = 1,167 -> tidak komplementer.
ORDERS = {
    1: ["tequila", "rum"],
    2: ["tequila", "rum"],
    3: ["tequila"],
    4: ["wine_red", "wine_white"],
    5: ["wine_white"],
    6: ["wine_white", "rum"],
    7: ["wine_red"],
    8: ["fresh fruits"],
    9: ["fresh fruits"],
    10: ["chips pretzels"],
}
ALKOHOL = {"tequila", "rum", "wine_red", "wine_white"}


@pytest.fixture(scope="module")
def con():
    con = duckdb.connect()
    rows = [(o, item, item in ALKOHOL) for o, items in ORDERS.items() for item in items]
    con.execute("create table order_item (order_id integer, item varchar, alkohol boolean)")
    con.executemany("insert into order_item values (?, ?, ?)", rows)
    basket.build_rules(con)
    basket.build_peran(con, min_lift=1.5, min_orders=1)
    yield con
    con.close()


def aturan(con, x, y):
    return con.execute(
        "select n_xy, confidence, lift, lift_alk from aturan_asosiasi where antecedent = ? and consequent = ?", [x, y]
    ).fetchone()


def test_lift_dibanding_order_alkohol(con):
    n_xy, confidence, lift, lift_alk = aturan(con, "tequila", "rum")
    assert n_xy == 2
    assert confidence == pytest.approx(2 / 3, abs=1e-4)
    assert lift == pytest.approx((2 / 3) / (3 / 10), abs=1e-3)
    assert lift_alk == pytest.approx((2 / 3) / (3 / 7), abs=1e-3)


def test_peran_komplementer(con):
    peran = dict(con.execute("select jenis, punya_peran_komplementer from peran_komplementer").fetchall())
    assert peran["tequila"] is True
    assert peran["wine_red"] is False
    assert con.execute(
        "select mitra_terkuat from peran_komplementer where jenis = 'tequila'"
    ).fetchone()[0] == "rum"
