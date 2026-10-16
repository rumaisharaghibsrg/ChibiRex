"""Tabel mapping manual: nama produk → jenis minuman, dipakai untuk Instacart dan Bibitor.

Aturan dicek berurutan dan yang pertama cocok dipakai, jadi pola yang lebih spesifik (liqueur
bermerek) ditaruh di depan pola umum. Pola memakai regex DuckDB pada nama produk huruf kecil.
"""

SPIRITS = [
    ("liqueur", r"liqueur|liquer|creme|schna?pps|schnpps|amaretto|triple sec|cordial|sambuca|irish cream"
                r"|kahlua|dekuyper|\bdk\b|mcgillicuddy|rumpleminze|goldschlager|grand marnier|yukon jack"
                r"|baileys|jagermeister|disaronno|chambord|frangelico|cointreau|southern comfort"
                r"|peppermint|buttershots|pucker|fireball|kamora|after ?shock|mentholated"),
    ("tequila", r"tequila|mezcal|cuervo|patron|\b1800\b|sauza|don julio|herradura|hornitos|margarita"
                r"|reposado|anejo|blanco"),
    ("rum", r"\brum\b|bacardi|capt(ain)? morgan|malibu|cruzan|kraken|sailor jerry|mt gay|mount gay"
            r"|goslings|myers"),
    ("vodka", r"vodka|\bvdka|smirnoff|absolut|stolichnaya|\bstoli\b|grey goose|ketel|tito|svedka|pinnacle"
              r"|zhenka|skyy|belvedere|three olives|new amsterdam|ciroc|deep eddy|burnett"),
    ("whiskey", r"whisk|bourbon|scotch|\brye\b|malt|jack daniel|jim beam|canadian|seagrams (7|vo)"
                r"|crown royal|dewar|johnnie walker|wild turkey|maker|evan williams|jameson|red stag|glen"
                r"|macallan|knob creek|bulleit|woodford|black velvet|kessler|early times|chivas|cutty"
                r"|lord calvert|sour mash|tennessee|moonsh|old crow|ezra brooks|clan macgregor"),
    ("gin", r"\bgin\b|tanqueray|beefeater|bombay|hendrick|gordon|gilbey"),
    ("brandy", r"brandy|cognac|armagnac|hennes+e?y|\be ?& ?j\b|christian bro|courvoisier|remy martin|martell"
               r"|\bvsop\b"),
]

WINE = [
    ("wine_sparkling", r"champ|\bbrut\b|prosecco|spumante|\bcava\b|sparkl|asti\b|cremant|extra dry|moet"),
    ("wine_red", r"\bcab|merlot|pinot n|pnt n|noir|syrah|shiraz|\bzin|znfdl|malbec|chianti|rioja|bordeaux"
                 r"|tempranillo|sangiovese|\brd\b|\bred\b|rosso|tinto|claret|grenache|petite sirah"
                 r"|montepulciano|primitivo|carmenere|barolo|valpolicella|cotes? du rhone|beaujolais|apothic"),
    ("wine_white", r"chard|sauv|svgn|pinot g|pnt g|grigio|gris\b|riesling|moscato|\bwh\b|white|blanc"
                   r"|gewurz|viognier|chenin|albarino|vinho verde|semillon|muscat|\bsb\b|chablis|sancerre|\brsl\b"),
]

# Aisle wine Instacart sudah menunjukkan warnanya, jadi tidak perlu kata kunci.
INSTACART_WINE_AISLE = {
    "red wines": "wine_red",
    "white wines": "wine_white",
    "specialty wines champagnes": "wine_sparkling",
}

KATEGORI = {j: "spirits" for j, _ in SPIRITS} | {j: "wine" for j, _ in WINE}
KATEGORI |= {"spirits_lain": "spirits", "wine_lain": "wine", "beer": "beer"}


def case_sql(rules: list[tuple[str, str]], column: str, fallback: str) -> str:
    """CASE SQL yang mengembalikan jenis pertama yang polanya cocok dengan `column`."""
    whens = " ".join(f"when regexp_matches(lower({column}), '{pattern}') then '{jenis}'" for jenis, pattern in rules)
    return f"case {whens} else '{fallback}' end"
