"""REST API tervalidasi untuk tools agent Rexa dan dashboard.

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
import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Path, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from agent.prompt import TUGAS_DEFAULT
from api import guardrails, sap, state
from api.agent_runner import AgentSedangBerjalan, PenjalanAgent, jalankan_agent_lokal
from api.schemas import (INVENTORY_ID, AgentRun, AgentRunIn, AgentRunMulai, AgentRunStatus, AuditEntry,
                         DraftPORequest, Hold, HoldRequest, Keputusan, Prioritas, PurchaseOrder, Realokasi,
                         RingkasanToko, Sku, StatusGuardrail, StatusPO, StatusStok, Substitusi, Toko)
from api.settings import Settings
from engine import basket, config
from engine.format import angka, rupiah
from sap_mock.app import create_sap_mock

TOOLS = "Tools agent"
APPROVAL = "Approval manusia"
GUARDRAIL = "Guardrail & audit"
AGENT = "Jejak agent"
DASHBOARD = "Dashboard"

# Inventory Health Score (proposal Bagian 3): risiko stockout, perputaran barang, dan stabilitas kas persediaan,
# masing-masing 0-100 dengan bobot sama. Dihitung dari SKU aktif (yang masih punya stok atau penjualan).
KOMPONEN_HEALTH = [
    ("KETERSEDIAAN", "Ketersediaan stok", "% SKU aktif yang stoknya masih di atas reorder point"),
    ("PERPUTARAN", "Perputaran barang", "% SKU aktif yang tidak menumpuk (bukan OVERSTOCK atau DEADSTOCK)"),
    ("STABILITAS_KAS", "Stabilitas kas persediaan",
     "% nilai persediaan yang tidak tertahan di SKU OVERSTOCK atau DEADSTOCK"),
]
HEALTH_SQL = """
    select any_value(s.kota) as kota, count(*) as sku_aktif,
        avg(case when s.status_stok <> 'REORDER' then 1.0 else 0 end) as ketersediaan,
        avg(case when s.status_stok not in ('OVERSTOCK', 'DEADSTOCK') then 1.0 else 0 end) as perputaran,
        coalesce(sum(s.nilai_stok_idr), 0) as nilai_stok,
        coalesce(sum(case when s.status_stok in ('OVERSTOCK', 'DEADSTOCK') then s.nilai_stok_idr end), 0) as tertahan,
        count(*) filter (where r.level_risiko = 'TINGGI') as risiko_tinggi
    from sku_metrics s left join risiko_stockout r using (inventory_id)
    where s.store = ? and s.status_stok <> 'TIDAK_AKTIF'
"""

SKU_SQL = """
    select s.*, bj.jenis, bj.status_komplementer, r.risiko_stockout, r.skor_risiko, r.level_risiko
    from sku_metrics s
    left join brand_jenis bj using (brand)
    left join risiko_stockout r using (inventory_id)
"""
TABEL_WAJIB = ["sku_metrics", "brand_jenis", "aturan_asosiasi", "risiko_stockout"]

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
        ada = {r[0] for r in app.state.duck.execute("select table_name from information_schema.tables").fetchall()}
        if kurang := [t for t in TABEL_WAJIB if t not in ada]:
            app.state.duck.close()
            raise RuntimeError(f"Tabel {', '.join(kurang)} belum ada di {settings.analytics_db}. "
                               "Hentikan API lalu jalankan `python -m engine.pipeline`.")
        state.init(settings.state_db)
        yield
        app.state.duck.close()

    app = FastAPI(
        title="Rexa Copilot API",
        version="0.1.0",
        description="Tools tervalidasi untuk agent Rexa (Smart Inventory & Cash Flow Copilot) dan dashboard. "
                    "Semua aksi agent wajib lewat API ini; guardrail dijalankan di kode, bukan di prompt.",
        lifespan=lifespan,
    )
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"],
                       allow_headers=["*"], expose_headers=["Idempotent-Replay", "Existing-Draft"])
    app.state.settings = settings
    app.state.agent = PenjalanAgent(settings.agent_runner or jalankan_agent_lokal, settings.clock)
    _routes(app)
    # Tiruan SAP ikut berjalan di server yang sama (/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV).
    app.mount("/sap", settings.sap_mock_app or create_sap_mock(settings.sap_mock_db))
    return app


def _sap_client(s: Settings) -> httpx.Client:
    return s.sap_client() if s.sap_client else httpx.Client(base_url=s.sap_base_url, timeout=15)


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


def _dengan_arah(sku: dict, s: Settings) -> dict:
    sku["arah_tren"] = guardrails.arah_tren(sku, s)
    return sku


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
    def list_sku(request: Request, store: int | None = None, status_stok: StatusStok | None = None,
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
        s = _settings(request)
        return [_dengan_arah(dict(zip(cols, row)), s) for row in rel.fetchall()]

    @app.get("/sku/{inventory_id}", response_model=Sku, tags=[TOOLS], operation_id="get_sku_metrics")
    def get_sku_metrics(request: Request, inventory_id: str = InventoryIdPath, cur=Depends(_duck)):
        """Metrik satu SKU di satu toko: stok, Vs, tren, lead time, reorder point, saran PO, dan Data Confidence Score."""
        return _dengan_arah(_ambil_sku(cur, inventory_id), _settings(request))

    @app.get("/stores/{store}/prioritas", response_model=Prioritas, tags=[TOOLS], operation_id="list_prioritas")
    def list_prioritas(store: int, request: Request, limit_naik: int = Query(2, ge=0, le=10),
                       limit_turun: int = Query(3, ge=0, le=10), cur=Depends(_duck)):
        """SKU yang perlu reorder di sebuah toko, dikelompokkan oleh kode: `naik` (penjualan naik, kandidat draf PO,
        urut dari tren × laju penjualan) dan `turun` (penjualan turun, kandidat Hold Reorder, urut dari nilai PO)."""
        s = _settings(request)
        dasar = (SKU_SQL + " where s.store = ? and s.perlu_reorder and s.beli_jan_sep >= ?"
                 " and s.data_confidence >= ? and s.nilai_saran_po_idr > 0")
        params = [store, config.TREN_BASIS_MIN, s.data_confidence_min]

        def ambil(syarat: str, urutan: str, nilai: float, limit: int) -> list[dict]:
            rel = cur.execute(f"{dasar} and {syarat} order by {urutan} limit ?", params + [nilai, limit])
            cols = [d[0] for d in rel.description]
            return [_dengan_arah(dict(zip(cols, row)), s) for row in rel.fetchall()]

        return {"store": store,
                "naik": ambil("s.tren_beli >= ?", "s.tren_beli * s.permintaan_harian desc", s.tren_naik_min, limit_naik),
                "turun": ambil("s.tren_beli < ?", "s.nilai_saran_po_idr desc", 1, limit_turun)}

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
            # Satu SKU hanya boleh punya satu draf yang menunggu keputusan manajer (mencegah PO ganda antar-sesi).
            draf = con.execute("select po_id from purchase_orders where inventory_id = ? and status = 'DRAFT'",
                               (body.inventory_id,)).fetchone()
            if draf:
                response.status_code = 200
                response.headers["Existing-Draft"] = "true"
                return _po(con, draf[0])

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

    @app.get("/purchase-orders/{po_id}/sap-payload", tags=[APPROVAL])
    def sap_payload(po_id: str, request: Request):
        """Pratinjau payload SAP (API_PURCHASEORDER_PROCESS_SRV) yang akan dikirim saat PO disetujui."""
        s = _settings(request)
        with state.baca(s.state_db) as con:
            po = _po(con, po_id)
        return {"po_id": po_id, "tujuan": f"POST {s.sap_base_url}/A_PurchaseOrder",
                "payload": sap.payload_po(po, s.clock())}

    def _putuskan(po_id: str, body: Keputusan, request: Request, status_baru: str) -> dict:
        s = _settings(request)
        sekarang = s.clock()
        with state.transaksi(s.state_db) as con:
            po = _po(con, po_id)
            if po["status"] != "DRAFT":
                raise galat(409, "STATUS_TIDAK_VALID",
                            f"PO {po_id} berstatus {po['status']}; hanya PO DRAFT yang bisa diputuskan.")
            sap_po = None
            if status_baru == "APPROVED":
                # Persetujuan baru berlaku kalau PO berhasil dibuat di SAP; kalau gagal, PO tetap DRAFT.
                try:
                    with _sap_client(s) as klien:
                        sap_po = sap.kirim_po(klien, sap.payload_po(po, sekarang))["PurchaseOrder"]
                except sap.SapError as e:
                    raise galat(502, "SAP_GAGAL", f"PO belum disetujui karena gagal dikirim ke SAP. {e}")
            con.execute(
                """update purchase_orders set status = ?, diputuskan_oleh = ?, diputuskan_pada = ?,
                   catatan_keputusan = ?, sap_po_number = ?, sap_dikirim_pada = ? where po_id = ?""",
                (status_baru, body.oleh, sekarang.isoformat(timespec="seconds"), body.catatan, sap_po,
                 sekarang.isoformat(timespec="seconds") if sap_po else None, po_id))
            state.audit(con, sekarang, body.oleh, f"po_{status_baru.lower()}", po_id,
                        {"catatan": body.catatan, "sap_po_number": sap_po})
            return _po(con, po_id)

    @app.post("/purchase-orders/{po_id}/approve", response_model=PurchaseOrder, tags=[APPROVAL])
    def approve_purchase_order(po_id: str, body: Keputusan, request: Request):
        """1-Click Approval oleh manajer: PO dibuat di SAP (API_PURCHASEORDER_PROCESS_SRV) dan nomor PO SAP disimpan.
        Hanya PO berstatus DRAFT yang bisa disetujui; kalau SAP gagal, persetujuan dibatalkan dan PO tetap DRAFT."""
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

    @app.post("/agent-runs", response_model=AgentRun, status_code=201, tags=[AGENT])
    def simpan_agent_run(body: AgentRunIn, request: Request):
        """Simpan jejak satu kali jalannya agent (tools yang dipanggil dan alasannya) untuk dashboard."""
        s = _settings(request)
        waktu = s.clock().isoformat(timespec="seconds")
        with state.transaksi(s.state_db) as con:
            con.execute(
                "insert or replace into agent_runs values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (body.run_id, waktu, body.tugas, body.store, body.model, body.jawaban,
                 json.dumps([l.model_dump() for l in body.langkah], ensure_ascii=False, default=str),
                 body.durasi_dtk, body.token_input, body.token_output, int(body.berhasil)))
        return {**body.model_dump(), "waktu": waktu}

    @app.get("/agent-runs", response_model=list[AgentRun], tags=[AGENT])
    def list_agent_runs(request: Request, limit: int = Query(20, ge=1, le=200)):
        with state.baca(_settings(request).state_db) as con:
            rows = con.execute("select * from agent_runs order by waktu desc limit ?", (limit,)).fetchall()
        return [{**dict(r), "langkah": json.loads(r["langkah"]), "berhasil": bool(r["berhasil"])} for r in rows]

    @app.post("/agent-runs/mulai", response_model=AgentRunStatus, status_code=202, tags=[DASHBOARD])
    def mulai_agent(body: AgentRunMulai, request: Request, cur=Depends(_duck)):
        """Tombol "Jalankan agent" di dashboard. Agent berjalan di latar (±30-60 detik dengan LLM lokal); pantau
        langkahnya lewat `GET /agent-runs/{run_id}` sampai status SELESAI atau GAGAL. Hanya satu agent sekaligus."""
        if not cur.execute("select 1 from sku_metrics where store = ? limit 1", [body.store]).fetchone():
            raise galat(404, "TOKO_TIDAK_ADA", f"Toko {body.store} tidak ditemukan.")
        try:
            return request.app.state.agent.mulai(body.tugas or TUGAS_DEFAULT.format(store=body.store), body.store)
        except AgentSedangBerjalan:
            raise galat(409, "AGENT_SEDANG_BERJALAN", "Agent masih berjalan; tunggu sampai selesai.")

    @app.get("/agent-runs/{run_id}", response_model=AgentRunStatus, tags=[DASHBOARD])
    def status_agent_run(run_id: str, request: Request):
        """Status dan langkah satu kali jalannya agent. Selama BERJALAN, `langkah` bertambah setiap agent
        memanggil tool; setelah SELESAI, `jawaban` berisi ringkasan akhir agent."""
        berjalan = request.app.state.agent.status(run_id)
        if berjalan and berjalan["status"] == "BERJALAN":
            return berjalan
        with state.baca(_settings(request).state_db) as con:
            row = con.execute("select * from agent_runs where run_id = ?", (run_id,)).fetchone()
        if row:
            return {**dict(row), "langkah": json.loads(row["langkah"]),
                    "status": "SELESAI" if row["berhasil"] else "GAGAL",
                    "mulai_pada": berjalan["mulai_pada"] if berjalan else None,
                    "pesan": None if row["berhasil"] else row["jawaban"]}
        if berjalan:  # gagal sebelum jejaknya sempat disimpan
            return berjalan
        raise galat(404, "AGENT_RUN_TIDAK_ADA", f"Agent run {run_id} tidak ditemukan.")

    # ---------------------------------------------------------------- dashboard

    @app.get("/stores", response_model=list[Toko], tags=[DASHBOARD])
    def list_toko(cur=Depends(_duck)):
        """Daftar toko untuk pilihan cabang di dashboard."""
        rows = cur.execute("""
            select store, any_value(kota) as kota, count(*) filter (where status_stok <> 'TIDAK_AKTIF') as sku_aktif,
                count(*) filter (where perlu_reorder) as perlu_reorder
            from sku_metrics group by store order by store
        """).fetchall()
        return [dict(zip(["store", "kota", "sku_aktif", "perlu_reorder"], r)) for r in rows]

    @app.get("/stores/{store}/ringkasan", response_model=RingkasanToko, tags=[DASHBOARD])
    def ringkasan_toko(store: int, request: Request, cur=Depends(_duck)):
        """Inventory Health Score dan angka KPI satu toko untuk dashboard. Health Score dan nilai stok dihitung dari
        data per tanggal simulasi; PO dan modal yang diselamatkan berasal dari tindakan agent dan manajer."""
        rel = cur.execute(HEALTH_SQL, [store])
        h = dict(zip([d[0] for d in rel.description], rel.fetchone()))
        jumlah_status = dict(cur.execute("select status_stok, count(*) from sku_metrics where store = ? group by 1",
                                         [store]).fetchall())
        if not jumlah_status:
            raise galat(404, "TOKO_TIDAK_ADA", f"Toko {store} tidak ditemukan.")
        nilai = {"KETERSEDIAAN": h["ketersediaan"] or 0, "PERPUTARAN": h["perputaran"] or 0,
                 "STABILITAS_KAS": 1 - h["tertahan"] / h["nilai_stok"] if h["nilai_stok"] else 1}
        komponen = [{"kode": k, "nama": nama, "nilai": round(100 * nilai[k], 1), "penjelasan": penjelasan}
                    for k, nama, penjelasan in KOMPONEN_HEALTH]

        with state.baca(_settings(request).state_db) as con:
            po = {r[0]: (r[1], r[2]) for r in con.execute(
                "select status, count(*), coalesce(sum(nilai_idr), 0) from purchase_orders where store = ? group by 1",
                (store,))}
            diselamatkan, uji = con.execute(
                """select coalesce(sum(modal_diselamatkan_idr), 0), coalesce(sum(nilai_uji_idr), 0) from holds
                   where store = ? and status = 'AKTIF'""", (store,)).fetchone()
        return {"store": store, "kota": h["kota"] or "", "per_tanggal": config.AS_OF,
                "health_score": round(sum(nilai.values()) / len(nilai) * 100),
                "rumus": "Rata-rata tiga komponen dengan bobot sama", "komponen": komponen,
                "sku_aktif": h["sku_aktif"], "jumlah_status": jumlah_status, "nilai_stok_idr": h["nilai_stok"],
                "modal_tertahan_idr": h["tertahan"], "sku_risiko_tinggi": h["risiko_tinggi"],
                "po_menunggu": po.get("DRAFT", (0, 0))[0], "nilai_po_menunggu_idr": po.get("DRAFT", (0, 0))[1],
                "po_disetujui": po.get("APPROVED", (0, 0))[0],
                "po_ditahan_guardrail": po.get("DITAHAN_GUARDRAIL", (0, 0))[0],
                "modal_diselamatkan_idr": diselamatkan, "exploration_budget_idr": uji}

    @app.get("/audit-log", response_model=list[AuditEntry], tags=[GUARDRAIL])
    def audit_log(request: Request, limit: int = Query(50, ge=1, le=500)):
        with state.baca(_settings(request).state_db) as con:
            rows = con.execute("select * from audit_log order by id desc limit ?", (limit,)).fetchall()
        return [{**dict(r), "detail": json.loads(r["detail"])} for r in rows]


app = create_app()
