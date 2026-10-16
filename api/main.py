"""REST API tervalidasi untuk tools agent ChibiRex.

Jalankan: `uvicorn api.main:app --reload`, lalu buka http://127.0.0.1:8000/docs.
Hentikan API sebelum menjalankan `python -m engine.pipeline`, karena DuckDB tidak bisa ditulis
selama API masih membukanya.
"""

import hashlib
import json
import math
from contextlib import asynccontextmanager
from datetime import date, timedelta
from uuid import uuid4

import duckdb
from fastapi import Depends, FastAPI, Header, HTTPException, Path, Query, Request, Response

from api import guardrails, state
from api.schemas import (INVENTORY_ID, AuditEntry, DraftPORequest, Hold, HoldRequest, Keputusan, PurchaseOrder,
                         Realokasi, Sku, StatusGuardrail, StatusPO, StatusStok, Substitusi)
from api.settings import Settings
from engine import basket, config
from engine.format import angka, rupiah

TOOLS = "Tools agent"
APPROVAL = "Approval manusia"
GUARDRAIL = "Guardrail & audit"

SKU_SQL = """
    select s.*, bj.jenis, bj.status_komplementer
    from sku_metrics s left join brand_jenis bj using (brand)
"""

IdempotencyKey = Header(alias="Idempotency-Key", min_length=8, max_length=100,
                        description="Kunci unik per aksi. Request ulang dengan kunci yang sama tidak membuat data ganda.")
InventoryIdPath = Path(pattern=INVENTORY_ID, examples=["74_PAENTMARWY_4222"])


def galat(status: int, kode: str, pesan: str, **extra) -> HTTPException:
    return HTTPException(status, detail={"kode": kode, "pesan": pesan, **extra})


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if not settings.analytics_db.exists():
            raise RuntimeError(f"{settings.analytics_db} belum ada. Jalankan `python -m engine.pipeline` dulu.")
        app.state.duck = duckdb.connect(str(settings.analytics_db), read_only=True)
        state.init(settings.state_db)
        yield
        app.state.duck.close()

    app = FastAPI(
        title="ChibiRex Copilot API",
        version="0.1.0",
        description="Tools tervalidasi untuk agent Smart Inventory & Cash Flow Copilot. "
                    "Semua aksi agent wajib lewat API ini; guardrail dijalankan di kode, bukan di prompt.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    _routes(app)
    return app


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _duck(request: Request):
    cur = request.app.state.duck.cursor()
    try:
        yield cur
    finally:
        cur.close()


def _ambil_sku(cur, inventory_id: str) -> dict:
    rel = cur.execute(SKU_SQL + " where s.inventory_id = ?", [inventory_id])
    row = rel.fetchone()
    if row is None:
        raise galat(404, "SKU_TIDAK_ADA", f"SKU {inventory_id} tidak ditemukan.")
    return dict(zip([d[0] for d in rel.description], row))


def _hash(body) -> str:
    return hashlib.sha256(body.model_dump_json().encode()).hexdigest()


def _idempotency_lama(con, kunci: str, endpoint: str, request_hash: str) -> str | None:
    row = con.execute("select endpoint, request_hash, resource_id from idempotency where kunci = ?", (kunci,)).fetchone()
    if row is None:
        return None
    if row["endpoint"] != endpoint or row["request_hash"] != request_hash:
        raise galat(409, "IDEMPOTENCY_KEY_BENTROK", "Idempotency-Key ini sudah dipakai untuk request yang berbeda.")
    return row["resource_id"]


def _simpan_idempotency(con, kunci, endpoint, request_hash, resource_id, sekarang) -> None:
    con.execute("insert into idempotency values (?, ?, ?, ?, ?)",
                (kunci, endpoint, request_hash, resource_id, sekarang.isoformat(timespec="seconds")))


def _po(con, po_id: str) -> dict:
    row = con.execute("select * from purchase_orders where po_id = ?", (po_id,)).fetchone()
    if row is None:
        raise galat(404, "PO_TIDAK_ADA", f"PO {po_id} tidak ditemukan.")
    po = dict(row)
    po["pelanggaran"] = json.loads(po["pelanggaran"])
    return po


def _hold(con, hold_id: str) -> dict:
    return dict(con.execute("select * from holds where hold_id = ?", (hold_id,)).fetchone())


def _routes(app: FastAPI) -> None:

    @app.get("/health", tags=[GUARDRAIL])
    def health():
        return {"status": "ok"}

    # ---------------------------------------------------------------- tools baca

    @app.get("/sku", response_model=list[Sku], tags=[TOOLS], operation_id="list_sku")
    def list_sku(store: int | None = None, status_stok: StatusStok | None = None,
                 limit: int = Query(20, ge=1, le=200), cur=Depends(_duck)):
        """Daftar SKU, bisa difilter per toko dan status stok. Diurutkan dari nilai PO yang disarankan terbesar."""
        where, params = [], []
        if store is not None:
            where.append("s.store = ?")
            params.append(store)
        if status_stok is not None:
            where.append("s.status_stok = ?")
            params.append(status_stok)
        sql = SKU_SQL + (" where " + " and ".join(where) if where else "")
        rel = cur.execute(sql + " order by s.nilai_saran_po_idr desc nulls last, s.inventory_id limit ?", params + [limit])
        cols = [d[0] for d in rel.description]
        return [dict(zip(cols, row)) for row in rel.fetchall()]

    @app.get("/sku/{inventory_id}", response_model=Sku, tags=[TOOLS], operation_id="get_sku_metrics")
    def get_sku_metrics(inventory_id: str = InventoryIdPath, cur=Depends(_duck)):
        """Metrik satu SKU di satu toko: stok, Vs, tren, lead time, reorder point, saran PO, dan Data Confidence Score."""
        return _ambil_sku(cur, inventory_id)

    @app.get("/sku/{inventory_id}/substitution", response_model=Substitusi, tags=[TOOLS],
             operation_id="check_substitution")
    def check_substitution(inventory_id: str = InventoryIdPath, cur=Depends(_duck)):
        """Cek peran komplementer jenis SKU (Market Basket Instacart). Dasar keputusan Hold Reorder."""
        _ambil_sku(cur, inventory_id)
        return basket.cek_peran_komplementer(cur, inventory_id)

    # ---------------------------------------------------------------- draf PO

    @app.post("/purchase-orders", response_model=PurchaseOrder, status_code=201, tags=[TOOLS],
              operation_id="draft_purchase_order")
    def draft_purchase_order(body: DraftPORequest, request: Request, response: Response,
                             idempotency_key: str = IdempotencyKey, cur=Depends(_duck)):
        """Susun draf PO. Status selalu DRAFT (menunggu 1-Click Approval) atau DITAHAN_GUARDRAIL kalau ada guardrail
        yang dilanggar: circuit breaker, Data Confidence rendah, qty > batas 3σ, atau batas nominal PO harian."""
        s = _settings(request)
        sku = _ambil_sku(cur, body.inventory_id)
        qty = body.qty if body.qty is not None else sku["saran_qty_po"]
        if qty <= 0:
            raise galat(422, "TIDAK_PERLU_REORDER",
                        f"SKU {body.inventory_id} tidak perlu reorder; isi qty kalau tetap ingin memesan.")
        if sku["harga_beli_usd"] is None:
            raise galat(422, "HARGA_TIDAK_ADA", f"Harga beli SKU {body.inventory_id} tidak diketahui.")
        nilai = round(qty * sku["harga_beli_usd"] * config.KURS_USD_IDR)
        sekarang = s.clock()
        request_hash = _hash(body)

        with state.transaksi(s.state_db) as con:
            lama = _idempotency_lama(con, idempotency_key, "draft_purchase_order", request_hash)
            if lama:
                response.status_code = 200
                response.headers["Idempotent-Replay"] = "true"
                return _po(con, lama)

            langgar = guardrails.cek_po(con, s, sku, qty, nilai, sekarang)
            status = "DITAHAN_GUARDRAIL" if langgar else "DRAFT"
            po_id = f"PO-{uuid4().hex[:10].upper()}"
            con.execute(
                """insert into purchase_orders (po_id, inventory_id, store, deskripsi, vendor_number, vendor_name,
                   qty, harga_beli_usd, nilai_idr, status, pelanggaran, alasan, dibuat_oleh, dibuat_pada)
                   values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (po_id, sku["inventory_id"], sku["store"], sku["deskripsi"], sku["vendor_number"], sku["vendor_name"],
                 qty, sku["harga_beli_usd"], nilai, status, json.dumps(langgar, ensure_ascii=False), body.alasan,
                 body.dibuat_oleh, sekarang.isoformat(timespec="seconds")))
            _simpan_idempotency(con, idempotency_key, "draft_purchase_order", request_hash, po_id, sekarang)
            state.audit(con, sekarang, body.dibuat_oleh, "draft_purchase_order", po_id,
                        {"inventory_id": sku["inventory_id"], "qty": qty, "nilai_idr": nilai, "status": status,
                         "pelanggaran": [p["kode"] for p in langgar], "alasan": body.alasan})
            if langgar and guardrails.perbarui_circuit_breaker(con, s, sekarang):
                state.audit(con, sekarang, "sistem", "circuit_breaker_terbuka", None,
                            {"pemicu": po_id})
            return _po(con, po_id)

    @app.get("/purchase-orders", response_model=list[PurchaseOrder], tags=[APPROVAL])
    def list_purchase_orders(request: Request, status: StatusPO | None = None, store: int | None = None,
                             limit: int = Query(50, ge=1, le=500)):
        where, params = [], []
        if status:
            where.append("status = ?")
            params.append(status)
        if store is not None:
            where.append("store = ?")
            params.append(store)
        sql = "select po_id from purchase_orders" + (" where " + " and ".join(where) if where else "")
        with state.baca(_settings(request).state_db) as con:
            ids = [r[0] for r in con.execute(sql + " order by dibuat_pada desc limit ?", params + [limit])]
            return [_po(con, i) for i in ids]

    @app.get("/purchase-orders/{po_id}", response_model=PurchaseOrder, tags=[APPROVAL])
    def get_purchase_order(po_id: str, request: Request):
        with state.baca(_settings(request).state_db) as con:
            return _po(con, po_id)

    def _putuskan(po_id: str, body: Keputusan, request: Request, status_baru: str) -> dict:
        s = _settings(request)
        sekarang = s.clock()
        with state.transaksi(s.state_db) as con:
            po = _po(con, po_id)
            if po["status"] != "DRAFT":
                raise galat(409, "STATUS_TIDAK_VALID",
                            f"PO {po_id} berstatus {po['status']}; hanya PO DRAFT yang bisa diputuskan.")
            con.execute(
                """update purchase_orders set status = ?, diputuskan_oleh = ?, diputuskan_pada = ?,
                   catatan_keputusan = ? where po_id = ?""",
                (status_baru, body.oleh, sekarang.isoformat(timespec="seconds"), body.catatan, po_id))
            state.audit(con, sekarang, body.oleh, f"po_{status_baru.lower()}", po_id, {"catatan": body.catatan})
            return _po(con, po_id)

    @app.post("/purchase-orders/{po_id}/approve", response_model=PurchaseOrder, tags=[APPROVAL])
    def approve_purchase_order(po_id: str, body: Keputusan, request: Request):
        """1-Click Approval oleh manajer. Hanya PO berstatus DRAFT yang bisa disetujui."""
        return _putuskan(po_id, body, request, "APPROVED")

    @app.post("/purchase-orders/{po_id}/reject", response_model=PurchaseOrder, tags=[APPROVAL])
    def reject_purchase_order(po_id: str, body: Keputusan, request: Request):
        return _putuskan(po_id, body, request, "REJECTED")

    # ---------------------------------------------------------------- hold & realokasi

    @app.post("/holds", response_model=Hold, status_code=201, tags=[TOOLS], operation_id="hold_reorder")
    def hold_reorder(body: HoldRequest, request: Request, response: Response,
                     idempotency_key: str = IdempotencyKey, cur=Depends(_duck)):
        """Tahan reorder SKU slow-moving. Hanya diizinkan kalau stok sudah di reorder point, Vs turun, jenisnya tidak
        komplementer, dan Data Confidence cukup. 10% PO tetap dibeli sebagai stok uji (exploration budget) dan
        hold ditinjau ulang tiap kuartal, supaya produk tidak dianggap mati selamanya (Death Spiral)."""
        s = _settings(request)
        sku = _ambil_sku(cur, body.inventory_id)
        substitusi = basket.cek_peran_komplementer(cur, body.inventory_id)
        sekarang = s.clock()
        request_hash = _hash(body)

        with state.transaksi(s.state_db) as con:
            lama = _idempotency_lama(con, idempotency_key, "hold_reorder", request_hash)
            if lama:
                response.status_code = 200
                response.headers["Idempotent-Replay"] = "true"
                return _hold(con, lama)
            aktif = con.execute("select hold_id from holds where inventory_id = ? and status = 'AKTIF'",
                                (body.inventory_id,)).fetchone()
            if aktif:
                response.status_code = 200
                return _hold(con, aktif[0])

            tolak = guardrails.cek_hold(s, sku, substitusi)
            if not tolak:
                qty = sku["saran_qty_po"]
                qty_uji = min(qty, max(1, math.ceil(qty * s.exploration_persen)))
                harga = sku["harga_beli_usd"] * config.KURS_USD_IDR
                modal_ditahan = round(qty * harga)
                nilai_uji = round(qty_uji * harga)
                review = date.fromisoformat(config.AS_OF) + timedelta(days=s.exploration_review_hari)
                hold_id = f"HOLD-{uuid4().hex[:10].upper()}"
                con.execute(
                    """insert into holds values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AKTIF', ?, ?, ?)""",
                    (hold_id, sku["inventory_id"], sku["store"], sku["deskripsi"], qty, modal_ditahan, qty_uji,
                     nilai_uji, modal_ditahan - nilai_uji, review.isoformat(), body.alasan, body.dibuat_oleh,
                     sekarang.isoformat(timespec="seconds")))
                _simpan_idempotency(con, idempotency_key, "hold_reorder", request_hash, hold_id, sekarang)
                state.audit(con, sekarang, body.dibuat_oleh, "hold_reorder", hold_id,
                            {"inventory_id": sku["inventory_id"], "modal_diselamatkan_idr": modal_ditahan - nilai_uji,
                             "alasan": body.alasan})
                return _hold(con, hold_id)
            state.audit(con, sekarang, body.dibuat_oleh, "hold_reorder_ditolak", body.inventory_id,
                        {"pelanggaran": [p["kode"] for p in tolak], "alasan": body.alasan})
        raise galat(422, "HOLD_DITOLAK", "Syarat Hold Reorder tidak terpenuhi.", pelanggaran=tolak)

    @app.get("/holds", response_model=list[Hold], tags=[APPROVAL])
    def list_holds(request: Request, store: int | None = None):
        sql, params = "select * from holds", []
        if store is not None:
            sql, params = sql + " where store = ?", [store]
        with state.baca(_settings(request).state_db) as con:
            return [dict(r) for r in con.execute(sql + " order by dibuat_pada desc", params)]

    @app.get("/stores/{store}/reallocation", response_model=Realokasi, tags=[TOOLS],
             operation_id="suggest_reallocation")
    def suggest_reallocation(store: int, request: Request, cur=Depends(_duck)):
        """Sarankan pengalihan modal: dana dari reorder yang ditahan dialokasikan ke SKU di toko yang sama yang
        penjualannya naik dan perlu reorder, diurutkan dari tren × laju penjualan tertinggi."""
        s = _settings(request)
        with state.baca(s.state_db) as con:
            sumber = [dict(r) for r in con.execute(
                "select * from holds where store = ? and status = 'AKTIF' order by dibuat_pada", (store,))]
        dana = sum(h["modal_diselamatkan_idr"] for h in sumber)
        rows = cur.execute("""
            select inventory_id, deskripsi, tren_beli, nilai_saran_po_idr from sku_metrics
            where store = ? and perlu_reorder and tren_beli >= ? and beli_jan_sep >= ? and data_confidence >= ?
              and nilai_saran_po_idr > 0
            order by tren_beli * permintaan_harian desc limit 5
        """, [store, s.tren_naik_min, config.TREN_BASIS_MIN, s.data_confidence_min]).fetchall()

        tujuan, sisa = [], dana
        for inventory_id, deskripsi, tren, nilai in rows:
            alokasi = min(sisa, nilai)
            sisa -= alokasi
            tujuan.append({"inventory_id": inventory_id, "deskripsi": deskripsi, "tren_beli": tren,
                           "nilai_po_idr": nilai, "dialokasikan_idr": alokasi})

        nama_sumber = ", ".join(h["deskripsi"] or h["inventory_id"] for h in sumber)
        didanai = [t for t in tujuan if t["dialokasikan_idr"] > 0]
        if not sumber:
            pesan = f"Belum ada reorder yang ditahan di toko {store}, jadi belum ada modal yang bisa dialihkan."
        elif not didanai:
            pesan = (f"Menahan reorder {nama_sumber} menghemat modal {rupiah(dana)}, tetapi belum ada SKU dengan "
                     "penjualan naik yang perlu reorder di toko ini.")
        else:
            daftar = ", ".join(f"{t['deskripsi']} (penjualan naik {angka(t['tren_beli'])}x, dialokasikan "
                               f"{rupiah(t['dialokasikan_idr'])})" for t in didanai)
            pesan = f"Menahan reorder {nama_sumber} menghemat modal {rupiah(dana)}. Alokasikan dana ini ke {daftar}."
            if sisa > 0:
                pesan += f" Sisa {rupiah(sisa)} tetap sebagai kas."
        return {"store": store, "dana_tersedia_idr": dana, "sumber": sumber, "tujuan": tujuan,
                "sisa_dana_idr": sisa, "pesan": pesan}

    # ---------------------------------------------------------------- guardrail & audit

    @app.get("/guardrails/status", response_model=StatusGuardrail, tags=[GUARDRAIL])
    def guardrail_status(request: Request, store: int | None = None):
        s = _settings(request)
        with state.baca(s.state_db) as con:
            breaker = guardrails.status_circuit_breaker(con)
            total = guardrails.total_po_hari_ini(con, store, s.clock()) if store is not None else None
        return {"circuit_breaker_terbuka": bool(breaker["terbuka"]), "alasan": breaker["alasan"],
                "berubah_pada": breaker["berubah_pada"], "batas_po_harian_idr": s.batas_po_harian_idr,
                "total_po_hari_ini_idr": total, "data_confidence_min": s.data_confidence_min,
                "outlier_sigma": s.outlier_sigma}

    @app.post("/guardrails/circuit-breaker/reset", response_model=StatusGuardrail, tags=[GUARDRAIL])
    def reset_circuit_breaker(body: Keputusan, request: Request):
        """Tutup kembali circuit breaker setelah manajer memeriksa penyebab anomali."""
        s = _settings(request)
        sekarang = s.clock()
        with state.transaksi(s.state_db) as con:
            con.execute("update circuit_breaker set terbuka = 0, alasan = ?, berubah_pada = ? where id = 1",
                        (f"direset oleh {body.oleh}", sekarang.isoformat(timespec="seconds")))
            state.audit(con, sekarang, body.oleh, "circuit_breaker_reset", None, {"catatan": body.catatan})
        return guardrail_status(request)

    @app.get("/audit-log", response_model=list[AuditEntry], tags=[GUARDRAIL])
    def audit_log(request: Request, limit: int = Query(50, ge=1, le=500)):
        with state.baca(_settings(request).state_db) as con:
            rows = con.execute("select * from audit_log order by id desc limit ?", (limit,)).fetchall()
        return [{**dict(r), "detail": json.loads(r["detail"])} for r in rows]


app = create_app()
