from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Format InventoryId Bibitor: toko_KOTA_brand. Nama kota bisa berisi spasi, apostrof, atau kosong.
INVENTORY_ID = r"^\d+_[A-Z' ]*_\d+$"

StatusStok = Literal["AMAN", "REORDER", "OVERSTOCK", "DEADSTOCK", "TIDAK_AKTIF"]
StatusPO = Literal["DRAFT", "DITAHAN_GUARDRAIL", "APPROVED", "REJECTED"]


class Request(BaseModel):
    # Field di luar skema ditolak, jadi agent tidak bisa menyelipkan misalnya "status": "APPROVED".
    model_config = ConfigDict(extra="forbid")


class Sku(BaseModel):
    inventory_id: str
    store: int
    kota: str
    brand: int
    deskripsi: str | None
    ukuran: str | None
    kategori: str | None
    jenis: str | None
    status_komplementer: str | None
    vendor_number: int | None
    vendor_name: str | None
    status_stok: StatusStok
    stok_akhir: int
    permintaan_harian: float
    sigma_harian: float
    lead_time_rata: float
    safety_stock: float
    reorder_point: float
    target_stok: float
    hari_cukup: float | None
    tgl_perkiraan_habis: date | None
    perlu_reorder: bool
    saran_qty_po: int
    nilai_saran_po_idr: float | None
    harga_beli_usd: float | None
    margin_pct: float | None
    nilai_stok_idr: float | None
    modal_berlebih_idr: float | None
    vs_jan: float | None
    vs_tahun: float | None
    tren_beli: float | None
    beli_jan_sep: int
    beli_q4: int
    hari_stok_kosong_jan: int | None
    data_confidence: float


class Mitra(BaseModel):
    jenis: str
    lift_alk: float
    order_bersama: int


class Substitusi(BaseModel):
    inventory_id: str
    deskripsi: str | None
    jenis: str | None
    status: Literal["KOMPLEMENTER", "TIDAK_KOMPLEMENTER", "TIDAK_DIKETAHUI"]
    mitra: list[Mitra]


class Pelanggaran(BaseModel):
    kode: str
    pesan: str


class DraftPORequest(Request):
    inventory_id: str = Field(pattern=INVENTORY_ID)
    qty: int | None = Field(default=None, gt=0, le=100_000, description="Kosongkan untuk memakai saran_qty_po")
    alasan: str = Field(min_length=10, max_length=2000, description="Alasan keputusan dari agent")
    dibuat_oleh: str = Field(default="agent", min_length=1, max_length=100)


class PurchaseOrder(BaseModel):
    po_id: str
    inventory_id: str
    store: int
    deskripsi: str | None
    vendor_number: int | None
    vendor_name: str | None
    qty: int
    harga_beli_usd: float
    nilai_idr: float
    status: StatusPO
    pelanggaran: list[Pelanggaran]
    alasan: str
    dibuat_oleh: str
    dibuat_pada: str
    diputuskan_oleh: str | None
    diputuskan_pada: str | None
    catatan_keputusan: str | None


class Keputusan(Request):
    oleh: str = Field(min_length=1, max_length=100)
    catatan: str | None = Field(default=None, max_length=1000)


class HoldRequest(Request):
    inventory_id: str = Field(pattern=INVENTORY_ID)
    alasan: str = Field(min_length=10, max_length=2000)
    dibuat_oleh: str = Field(default="agent", min_length=1, max_length=100)


class Hold(BaseModel):
    hold_id: str
    inventory_id: str
    store: int
    deskripsi: str | None
    qty_ditahan: int
    modal_ditahan_idr: float
    qty_uji: int = Field(description="Exploration budget: stok uji per kuartal untuk mencegah Death Spiral")
    nilai_uji_idr: float
    modal_diselamatkan_idr: float
    review_pada: str = Field(description="Tanggal (simulasi) hold ditinjau ulang")
    status: Literal["AKTIF", "SELESAI"]
    alasan: str
    dibuat_oleh: str
    dibuat_pada: str


class TujuanRealokasi(BaseModel):
    inventory_id: str
    deskripsi: str | None
    tren_beli: float
    nilai_po_idr: float
    dialokasikan_idr: float


class Realokasi(BaseModel):
    store: int
    dana_tersedia_idr: float
    sumber: list[Hold]
    tujuan: list[TujuanRealokasi]
    sisa_dana_idr: float
    pesan: str


class StatusGuardrail(BaseModel):
    circuit_breaker_terbuka: bool
    alasan: str | None
    berubah_pada: str | None
    batas_po_harian_idr: float
    total_po_hari_ini_idr: float | None
    data_confidence_min: float
    outlier_sigma: float


class AuditEntry(BaseModel):
    id: int
    waktu: str
    aktor: str
    aksi: str
    resource_id: str | None
    detail: dict
