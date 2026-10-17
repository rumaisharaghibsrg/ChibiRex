"""Tiruan SAP S/4HANA: layanan OData V2 API_PURCHASEORDER_PROCESS_SRV, cukup untuk membuat dan membaca PO.

Meniru perilaku SAP Gateway yang relevan untuk integrasi: path URL yang sama, amplop respons OData V2
(`{"d": ...}`), token CSRF (GET dengan `x-csrf-token: Fetch`, lalu POST membawa token dan cookie sesi),
nomor PO 45xxxxxxxx, dan format galat OData. Layanan V2 ini berstatus deprecated di SAP (pengganti:
OData V4 CE_PURCHASEORDER_0001), tetapi paling banyak contohnya untuk prototipe.

Jalankan terpisah: `uvicorn sap_mock.app:app --port 8001`, atau biarkan ikut ter-mount di API utama (/sap).
"""

import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from engine.config import ROOT

from sap_mock import SERVICE
NOMOR_AWAL = 4500000001
WAJIB_HEADER = ["CompanyCode", "PurchaseOrderType", "Supplier", "PurchasingOrganization", "PurchasingGroup",
                "DocumentCurrency"]
WAJIB_ITEM = ["PurchaseOrderItem", "Plant", "Material", "OrderQuantity"]


def _galat(status: int, kode: str, pesan: str, **headers) -> JSONResponse:
    return JSONResponse({"error": {"code": kode, "message": {"lang": "en", "value": pesan}}},
                        status_code=status, headers=headers)


def _tanggal_odata(waktu: datetime) -> str:
    return f"/Date({int(waktu.timestamp() * 1000)})/"


def _validasi(po: dict) -> str | None:
    for f in WAJIB_HEADER:
        if not po.get(f):
            return f"Property {f} is required"
    items = (po.get("to_PurchaseOrderItem") or {}).get("results") or []
    if not items:
        return "At least one purchase order item is required (to_PurchaseOrderItem)"
    for item in items:
        for f in WAJIB_ITEM:
            if not item.get(f):
                return f"Item property {f} is required"
        try:
            if Decimal(str(item["OrderQuantity"])) <= 0:
                return "OrderQuantity must be greater than zero"
        except InvalidOperation:
            return "OrderQuantity must be a decimal value"
    return None


def create_sap_mock(db_path: Path) -> FastAPI:
    token_sesi: dict[str, str] = {}

    app = FastAPI(title="Mock SAP S/4HANA: API_PURCHASEORDER_PROCESS_SRV",
                  description="Tiruan SAP untuk demo ChibiRex. Bukan sistem SAP sungguhan.")

    @contextmanager
    def koneksi():
        # Database dibuat saat request pertama, bukan saat import, supaya import modul tidak menulis ke disk.
        db_path.parent.mkdir(parents=True, exist_ok=True)
        c = sqlite3.connect(db_path, timeout=10, isolation_level=None)
        try:
            c.execute("create table if not exists purchase_order (nomor text primary key, data text not null)")
            yield c
        finally:
            c.close()

    def dengan_metadata(po: dict, request: Request) -> dict:
        uri = f"{str(request.base_url).rstrip('/')}{SERVICE}/A_PurchaseOrder('{po['PurchaseOrder']}')"
        return {"__metadata": {"id": uri, "uri": uri, "type": "API_PURCHASEORDER_PROCESS_SRV.A_PurchaseOrderType"},
                **po}

    @app.get(SERVICE + "/")
    @app.get(SERVICE)
    def service_root(request: Request, response: Response):
        """Root layanan. Kirim header `x-csrf-token: Fetch` untuk mendapat token sebelum POST."""
        if request.headers.get("x-csrf-token", "").lower() == "fetch":
            sesi = request.cookies.get("SAP_SESSIONID") or secrets.token_hex(16)
            token_sesi[sesi] = secrets.token_urlsafe(24)
            response.headers["x-csrf-token"] = token_sesi[sesi]
            response.set_cookie("SAP_SESSIONID", sesi, path="/", httponly=True)
        return {"d": {"EntitySets": ["A_PurchaseOrder", "A_PurchaseOrderItem"]}}

    @app.post(SERVICE + "/A_PurchaseOrder", status_code=201)
    async def buat_po(request: Request):
        sesi = request.cookies.get("SAP_SESSIONID")
        if not sesi or request.headers.get("x-csrf-token") != token_sesi.get(sesi):
            return _galat(403, "CSRF", "CSRF token validation failed", **{"x-csrf-token": "Required"})
        try:
            po = await request.json()
        except json.JSONDecodeError:
            return _galat(400, "/IWBEP/CM_MGW_RT/020", "The request body is not valid JSON")
        if pesan := _validasi(po):
            return _galat(400, "ME/083", pesan)

        sekarang = datetime.now(timezone.utc)
        with koneksi() as c:
            c.execute("begin immediate")
            try:
                terakhir = c.execute("select max(cast(nomor as integer)) from purchase_order").fetchone()[0]
                nomor = str((terakhir or NOMOR_AWAL - 1) + 1)
                po = {**po, "PurchaseOrder": nomor, "CreationDate": _tanggal_odata(sekarang),
                      "PurchaseOrderDate": po.get("PurchaseOrderDate") or _tanggal_odata(sekarang)}
                for item in po["to_PurchaseOrderItem"]["results"]:
                    item["PurchaseOrder"] = nomor
                c.execute("insert into purchase_order values (?, ?)", (nomor, json.dumps(po, ensure_ascii=False)))
                c.execute("commit")
            except BaseException:
                c.execute("rollback")
                raise
        return {"d": dengan_metadata(po, request)}

    @app.get(SERVICE + "/A_PurchaseOrder('{nomor}')")
    def baca_po(nomor: str, request: Request):
        with koneksi() as c:
            row = c.execute("select data from purchase_order where nomor = ?", (nomor,)).fetchone()
        if row is None:
            return _galat(404, "/IWBEP/CM_MGW_RT/021", f"Resource not found for segment A_PurchaseOrder('{nomor}')")
        return {"d": dengan_metadata(json.loads(row[0]), request)}

    @app.get(SERVICE + "/A_PurchaseOrder")
    def daftar_po(request: Request):
        with koneksi() as c:
            rows = c.execute("select data from purchase_order order by nomor desc").fetchall()
        return {"d": {"results": [dengan_metadata(json.loads(r[0]), request) for r in rows]}}

    return app


def __getattr__(nama: str):
    # `uvicorn sap_mock.app:app` mengambil atribut ini; dibuat saat diminta, bukan saat import.
    if nama == "app":
        return create_sap_mock(ROOT / "data" / "processed" / "sap_mock.sqlite")
    raise AttributeError(nama)
