"""Integrasi SAP: susun payload PO format API_PURCHASEORDER_PROCESS_SRV (OData V2) dan kirim ke SAP.

Data organisasi (company code, purchasing org/group) memakai nilai contoh. Di pilot riil, nilainya
diambil dari master data SAP pelanggan.
"""

from datetime import datetime, timezone

import httpx

from engine import config

COMPANY_CODE = "1710"
PURCHASING_ORGANIZATION = "1710"
PURCHASING_GROUP = "001"
PURCHASE_ORDER_TYPE = "NB"  # PO standar
MATA_UANG = "IDR"


class SapError(Exception):
    pass


def plant(store: int) -> str:
    return f"T{store:03d}"  # satu toko = satu plant


def material(inventory_id: str) -> str:
    return f"BIB-{inventory_id.rsplit('_', 1)[1]}"  # nomor brand Bibitor


def payload_po(po: dict, tanggal: datetime) -> dict:
    harga_satuan = round(po["harga_beli_usd"] * config.KURS_USD_IDR)
    return {
        "CompanyCode": COMPANY_CODE,
        "PurchaseOrderType": PURCHASE_ORDER_TYPE,
        "Supplier": str(po["vendor_number"]),
        "PurchasingOrganization": PURCHASING_ORGANIZATION,
        "PurchasingGroup": PURCHASING_GROUP,
        "DocumentCurrency": MATA_UANG,
        "PurchaseOrderDate": f"/Date({int(datetime(tanggal.year, tanggal.month, tanggal.day, tzinfo=timezone.utc).timestamp() * 1000)})/",
        "to_PurchaseOrderItem": {"results": [{
            "PurchaseOrderItem": "10",
            "Plant": plant(po["store"]),
            "Material": material(po["inventory_id"]),
            "OrderQuantity": str(po["qty"]),
            "DocumentCurrency": MATA_UANG,
            "RequisitionerName": "ChibiRex",
            "to_PurchaseOrderPricingElement": {"results": [{
                "ConditionType": "PBXX",  # harga beli yang diinput manual
                "ConditionRateValue": str(harga_satuan),
                "ConditionCurrency": MATA_UANG,
                "ConditionQuantity": "1",
            }]},
        }]},
    }


def kirim_po(client: httpx.Client, payload: dict) -> dict:
    """Buat PO di SAP mengikuti alur SAP Gateway: ambil token CSRF dulu, lalu POST dengan token itu."""
    try:
        r = client.get("/", headers={"x-csrf-token": "Fetch", "Accept": "application/json"})
        token = r.headers.get("x-csrf-token")
        if not token:
            raise SapError(f"SAP tidak memberi token CSRF (HTTP {r.status_code})")
        r = client.post("/A_PurchaseOrder", json=payload,
                        headers={"x-csrf-token": token, "Accept": "application/json"})
    except httpx.HTTPError as e:
        raise SapError(f"SAP tidak bisa dihubungi: {e}") from e
    if r.status_code != 201:
        try:
            pesan = r.json()["error"]["message"]["value"]
        except (ValueError, KeyError, TypeError):
            pesan = r.text[:200]
        raise SapError(f"SAP menolak PO (HTTP {r.status_code}): {pesan}")
    return r.json()["d"]
