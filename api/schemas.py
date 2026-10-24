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
    stok_akhir: int = Field(description="Stok di gudang pada hari simulasi (lihat GET /simulasi)")
    stok_dalam_pengiriman: int = Field(default=0, description="Barang dari PO yang disetujui yang belum tiba")
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
    arah_tren: Literal["NAIK", "TURUN", "STABIL", "TIDAK_ANDAL"] | None = None
    beli_jan_sep: int
    beli_q4: int
    hari_stok_kosong_jan: int | None
    data_confidence: float = Field(description="0-1; ikut turun kalau ada selisih hitung fisik yang belum diaudit")
    stok_fisik: int | None = Field(default=None, description="Hasil hitung fisik terakhir yang belum diaudit")
    stok_fisik_dicatat_pada: str | None = None
    risiko_stockout: float | None = Field(default=None, description="Probabilitas mentah model (indikatif)")
    skor_risiko: int | None = Field(default=None, description="Confidence Score risiko stok habis, peringkat 0-100")
    level_risiko: Literal["TINGGI", "SEDANG", "RENDAH"] | None = None


class SkuRingkas(BaseModel):
    inventory_id: str
    deskripsi: str | None
    jenis: str | None
    arah_tren: str
    tren_beli: float | None
    perlu_reorder: bool
    status_stok: StatusStok
    stok_akhir: int
    reorder_point: float
    saran_qty_po: int
    nilai_saran_po_idr: float | None
    skor_risiko: int | None = None
    level_risiko: str | None = None


class Prioritas(BaseModel):
    store: int
    naik: list[SkuRingkas] = Field(description="Penjualan naik dan perlu reorder: kandidat draf PO")
    turun: list[SkuRingkas] = Field(description="Penjualan turun dan perlu reorder: kandidat Hold Reorder")


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
    sap_po_number: str | None = Field(default=None, description="Nomor PO di SAP setelah disetujui")
    sap_dikirim_pada: str | None = None
    tgl_tiba: date | None = Field(default=None, description="Tanggal simulasi barang masuk gudang (PO disetujui)")


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


class StokFisikRequest(Request):
    stok_fisik: int = Field(ge=0, le=1_000_000, description="Jumlah unit hasil hitung fisik di rak dan gudang")
    dicatat_oleh: str = Field(min_length=1, max_length=100)
    catatan: str | None = Field(default=None, max_length=1000)


class StokFisik(BaseModel):
    inventory_id: str
    store: int
    deskripsi: str | None = None
    stok_sistem: int
    stok_fisik: int
    selisih: int = Field(description="stok fisik - stok sistem")
    data_confidence_data: float = Field(description="Data Confidence dari riwayat data, sebelum hitung fisik")
    data_confidence: float = Field(description="Data Confidence yang berlaku sekarang")
    perlu_audit: bool = Field(description="Data Confidence di bawah ambang: PO ditahan sampai selisih diaudit")
    dicatat_oleh: str
    catatan: str | None
    dicatat_pada: str


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


class LangkahAgent(BaseModel):
    tool: str
    input: dict
    output: dict | list | str | None
    detik: float


class AgentRunIn(Request):
    run_id: str = Field(min_length=8, max_length=64)
    tugas: str = Field(min_length=1, max_length=2000)
    store: int | None = None
    model: str = Field(max_length=200)
    jawaban: str = Field(max_length=20000)
    langkah: list[LangkahAgent]
    durasi_dtk: float
    token_input: int
    token_output: int
    berhasil: bool


class AgentRun(AgentRunIn):
    # Respons, bukan request: kolom tambahan dari tabel (misalnya mulai_pada) diabaikan, tidak ditolak.
    model_config = ConfigDict(extra="ignore")
    waktu: str
    status: str | None = Field(default=None, description="SELESAI atau GAGAL; kosong untuk jejak lama")
    pesan: str | None = Field(default=None, description="Penyebab kalau GAGAL, misalnya tidak ada worker")


class AgentRunMulai(Request):
    store: int
    tugas: str | None = Field(default=None, max_length=2000, description="Kosongkan untuk prosedur standar")


class AgentRunTugas(BaseModel):
    run_id: str
    tugas: str
    store: int | None


class StatusWorker(BaseModel):
    mode: str = Field(description="lokal, antrian, atau mati (lihat api/settings.py)")
    aktif: bool = Field(description="Mode antrian: worker di laptop baru saja mengambil antrian")
    terakhir_terlihat: str | None
    nama: str | None


class AgentRunStatus(BaseModel):
    run_id: str
    status: Literal["MENUNGGU", "BERJALAN", "SELESAI", "GAGAL"] = Field(
        description="MENUNGGU = mode antrian, belum diambil worker di laptop")
    store: int | None
    tugas: str
    langkah: list[LangkahAgent] = Field(description="Tool yang sudah dipanggil, bertambah selama agent berjalan")
    mulai_pada: str | None = None
    waktu: str | None = Field(default=None, description="Waktu jejak disimpan (setelah selesai)")
    model: str | None = None
    jawaban: str | None = Field(default=None, description="Ringkasan akhir agent (setelah selesai)")
    durasi_dtk: float | None = None
    token_input: int | None = None
    token_output: int | None = None
    pesan: str | None = Field(default=None, description="Penyebab kalau GAGAL")


class StatusSimulasi(BaseModel):
    hari_ke: int = Field(description="Hari simulasi sejak 31 Des 2016 (data terakhir Bibitor)")
    tanggal: date
    otomatis: bool = Field(description="Waktu maju sendiri, satu hari tiap `detik_per_hari` detik")
    detik_per_hari: float
    hari_maks: int


class MajuSimulasi(Request):
    hari: int = Field(ge=1, le=30)
    oleh: str = Field(default="manajer", min_length=1, max_length=100)


class KembaliSimulasi(Request):
    oleh: str = Field(default="manajer", min_length=1, max_length=100)


class OtomatisSimulasi(Request):
    aktif: bool
    detik_per_hari: float | None = Field(default=None, ge=5, le=3600, description="Kosongkan untuk kecepatan terakhir")
    oleh: str = Field(default="manajer", min_length=1, max_length=100)


class Toko(BaseModel):
    store: int
    kota: str
    sku_aktif: int
    perlu_reorder: int


class KomponenHealth(BaseModel):
    kode: Literal["KETERSEDIAAN", "PERPUTARAN", "STABILITAS_KAS"]
    nama: str
    nilai: float = Field(description="0-100")
    penjelasan: str


class RingkasanToko(BaseModel):
    store: int
    kota: str
    per_tanggal: date = Field(description="Tanggal data (simulasi dari Bibitor)")
    health_score: int = Field(description="Inventory Health Score 0-100 = rata-rata komponen")
    rumus: str
    komponen: list[KomponenHealth]
    sku_aktif: int
    jumlah_status: dict[str, int]
    nilai_stok_idr: float
    modal_tertahan_idr: float = Field(description="Nilai stok di SKU OVERSTOCK dan DEADSTOCK")
    sku_risiko_tinggi: int
    po_menunggu: int = Field(description="Draf PO yang menunggu 1-Click Approval")
    nilai_po_menunggu_idr: float
    po_disetujui: int
    po_ditahan_guardrail: int
    modal_diselamatkan_idr: float = Field(description="Dari Hold Reorder yang aktif")
    exploration_budget_idr: float = Field(description="Nilai stok uji dari Hold Reorder yang aktif")


class AuditEntry(BaseModel):
    id: int
    waktu: str
    aktor: str
    aksi: str
    resource_id: str | None
    detail: dict
