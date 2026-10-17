"""Tools Strands untuk agent. Semua aksi lewat REST API Tahap 4 (tidak pernah menyentuh database langsung).

Hasil API diringkas ke field penting saja supaya muat di konteks model lokal (8K token). Penolakan
guardrail dikembalikan sebagai data (bukan exception), supaya agent bisa menjelaskannya ke pengguna.
"""

import time

import httpx
from strands import tool

MAKS_PANGGILAN = 15  # pengaman kalau model berputar-putar memanggil tool

FIELD_SKU = ["inventory_id", "deskripsi", "jenis", "status_stok", "perlu_reorder", "arah_tren", "tren_beli",
             "stok_akhir", "reorder_point", "saran_qty_po", "nilai_saran_po_idr", "tgl_perkiraan_habis",
             "status_komplementer", "data_confidence"]
FIELD_PRIORITAS = ["inventory_id", "deskripsi", "jenis", "arah_tren", "perlu_reorder", "saran_qty_po",
                   "nilai_saran_po_idr"]
FIELD_PO = ["po_id", "inventory_id", "deskripsi", "qty", "nilai_idr", "status"]
FIELD_HOLD = ["hold_id", "inventory_id", "deskripsi", "qty_ditahan", "qty_uji", "modal_diselamatkan_idr",
              "review_pada", "status"]


def _pilih(data: dict, field: list[str]) -> dict:
    return {k: data.get(k) for k in field}


class AlatAgent:
    """Membuat tools Strands yang terikat ke satu sesi agent (run_id) dan satu klien HTTP."""

    def __init__(self, client: httpx.Client, run_id: str, pembuat: str, verbose: bool = False):
        self.client = client
        self.run_id = run_id
        self.pembuat = pembuat[:100]
        self.verbose = verbose
        self.langkah: list[dict] = []
        # SKU yang boleh diberi tindakan pada sesi ini, diisi dari hasil list_prioritas.
        self.prioritas: dict[str, set[str]] | None = None

    def _di_luar_prioritas(self, inventory_id: str, daftar: str, tindakan: str) -> dict | None:
        """Tindakan hanya untuk SKU di daftar prioritas dari sistem, bukan SKU lain yang disebut tool lain."""
        if self.prioritas is None:
            return {"ditolak": True, "kode": "PRIORITAS_BELUM_DIAMBIL", "pesan": "Panggil list_prioritas dulu."}
        if inventory_id not in self.prioritas[daftar]:
            return {"ditolak": True, "kode": f"BUKAN_DAFTAR_{daftar.upper()}",
                    "pesan": f"{tindakan} hanya untuk SKU di daftar '{daftar}' dari list_prioritas."}
        return None

    def _catat(self, nama: str, masukan: dict, fungsi) -> dict | list:
        mulai = time.perf_counter()
        if len(self.langkah) >= MAKS_PANGGILAN:
            hasil = {"error": f"Batas {MAKS_PANGGILAN} pemanggilan tool tercapai. Hentikan dan buat ringkasan sekarang."}
        else:
            try:
                hasil = fungsi()
            except httpx.HTTPError as e:
                hasil = {"error": f"API tidak bisa dihubungi: {e}"}
        detik = round(time.perf_counter() - mulai, 2)
        self.langkah.append({"tool": nama, "input": masukan, "output": hasil, "detik": detik})
        if self.verbose:
            print(f"  -> {nama}({', '.join(f'{k}={v!r}' for k, v in masukan.items())})")
        return hasil

    def _respons(self, r: httpx.Response, ringkas):
        if r.status_code < 400:
            return ringkas(r.json())
        detail = r.json().get("detail") if r.headers.get("content-type", "").startswith("application/json") else None
        if isinstance(detail, dict):  # galat terstruktur dari API, misalnya HOLD_DITOLAK
            return {"ditolak": True, **detail}
        return {"error": f"HTTP {r.status_code}: {detail or r.text[:200]}"}

    def _kunci(self, aksi: str, inventory_id: str) -> dict:
        return {"Idempotency-Key": f"agent-{self.run_id}-{aksi}-{inventory_id}"}

    @staticmethod
    def _alasan(alasan: str) -> str:
        alasan = alasan.strip()
        return alasan if len(alasan) >= 10 else f"{alasan} (keputusan agent ChibiRex)"

    def tools(self) -> list:
        alat = self

        @tool
        def list_prioritas(store: int) -> dict:
            """Daftar SKU yang perlu reorder di sebuah toko, sudah dikelompokkan oleh sistem. Panggil ini pertama.
            'naik' = penjualan naik (kandidat draf PO). 'turun' = penjualan turun (kandidat Hold Reorder).

            Args:
                store: Nomor toko, misalnya 74.
            """
            def f():
                r = alat.client.get(f"/stores/{store}/prioritas")
                hasil = alat._respons(r, lambda d: {k: [_pilih(s, FIELD_PRIORITAS) for s in d[k]] for k in ("naik", "turun")})
                if "naik" in hasil:
                    alat.prioritas = {k: {s["inventory_id"] for s in hasil[k]} for k in ("naik", "turun")}
                return hasil
            return alat._catat("list_prioritas", {"store": store}, f)

        @tool
        def get_sku_metrics(inventory_id: str) -> dict:
            """Metrik satu SKU: stok, reorder point, arah tren, saran PO, dan status komplementer.

            Args:
                inventory_id: ID SKU persis seperti dari hasil list_prioritas, misalnya 74_PAENTMARWY_4222.
            """
            def f():
                r = alat.client.get(f"/sku/{inventory_id}")
                return alat._respons(r, lambda d: _pilih(d, FIELD_SKU))
            return alat._catat("get_sku_metrics", {"inventory_id": inventory_id}, f)

        @tool
        def check_substitution(inventory_id: str) -> dict:
            """Cek apakah jenis minuman SKU ini punya peran komplementer (sering dibeli bersama jenis lain).
            Wajib dipanggil sebelum hold_reorder.

            Args:
                inventory_id: ID SKU dari hasil list_prioritas.
            """
            def f():
                r = alat.client.get(f"/sku/{inventory_id}/substitution")
                return alat._respons(r, lambda d: {"inventory_id": d["inventory_id"], "jenis": d["jenis"],
                                                   "status": d["status"], "mitra": d["mitra"][:2]})
            return alat._catat("check_substitution", {"inventory_id": inventory_id}, f)

        @tool
        def hold_reorder(inventory_id: str, alasan: str) -> dict:
            """Tahan reorder SKU yang penjualannya turun dan status komplementernya TIDAK_KOMPLEMENTER.
            Sistem menolak kalau syarat tidak terpenuhi; hasilnya berisi 'ditolak' dan daftar pelanggaran.

            Args:
                inventory_id: ID SKU dari hasil list_prioritas.
                alasan: Alasan singkat 1-2 kalimat, mengutip field hasil tool.
            """
            def f():
                if tolak := alat._di_luar_prioritas(inventory_id, "turun", "Hold Reorder"):
                    return tolak
                body = {"inventory_id": inventory_id, "alasan": alat._alasan(alasan), "dibuat_oleh": alat.pembuat}
                r = alat.client.post("/holds", json=body, headers=alat._kunci("hold", inventory_id))
                return alat._respons(r, lambda d: _pilih(d, FIELD_HOLD))
            return alat._catat("hold_reorder", {"inventory_id": inventory_id, "alasan": alasan}, f)

        @tool
        def suggest_reallocation(store: int) -> dict:
            """Saran pengalihan modal dari reorder yang ditahan ke SKU yang penjualannya naik di toko yang sama.
            Panggil setelah hold_reorder. Hasilnya hanya informasi untuk ringkasan, bukan daftar SKU untuk dibuatkan PO.

            Args:
                store: Nomor toko, misalnya 74.
            """
            def f():
                r = alat.client.get(f"/stores/{store}/reallocation")
                return alat._respons(r, lambda d: {
                    "dana_tersedia_idr": d["dana_tersedia_idr"], "sisa_dana_idr": d["sisa_dana_idr"],
                    "tujuan": [{k: t[k] for k in ("inventory_id", "deskripsi", "dialokasikan_idr")} for t in d["tujuan"]],
                    "pesan": d["pesan"]})
            return alat._catat("suggest_reallocation", {"store": store}, f)

        @tool
        def draft_purchase_order(inventory_id: str, alasan: str) -> dict:
            """Susun draf PO untuk SKU yang penjualannya naik dan perlu reorder. Jumlah memakai saran sistem.
            Status hasilnya DRAFT (menunggu persetujuan manajer) atau DITAHAN_GUARDRAIL beserta pelanggarannya.

            Args:
                inventory_id: ID SKU dari hasil list_prioritas.
                alasan: Alasan singkat 1-2 kalimat, mengutip field hasil tool.
            """
            def f():
                if tolak := alat._di_luar_prioritas(inventory_id, "naik", "Draf PO"):
                    return tolak
                body = {"inventory_id": inventory_id, "alasan": alat._alasan(alasan), "dibuat_oleh": alat.pembuat}
                r = alat.client.post("/purchase-orders", json=body, headers=alat._kunci("po", inventory_id))
                return alat._respons(r, lambda d: {**_pilih(d, FIELD_PO),
                                                   "pelanggaran": [p["kode"] for p in d["pelanggaran"]]})
            return alat._catat("draft_purchase_order", {"inventory_id": inventory_id, "alasan": alasan}, f)

        return [list_prioritas, get_sku_metrics, check_substitution, hold_reorder, suggest_reallocation,
                draft_purchase_order]
