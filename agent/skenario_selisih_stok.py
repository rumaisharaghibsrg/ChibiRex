"""Skenario uji selisih stok: `python -m agent.skenario_selisih_stok --store 74` (API harus sudah berjalan).

Data Bibitor konsisten sempurna, jadi fitur mitigasi inakurasi data (proposal Bagian 5) didemokan dengan
mencatat hasil hitung fisik (simulasi) yang lebih kecil dari stok sistem untuk SKU prioritas teratas. Data
Confidence turun di bawah ambang, sehingga saat agent dijalankan, draf PO SKU itu ditahan guardrail
DATA_CONFIDENCE_RENDAH dan manajer diminta mengaudit stok. Akhiri demo dengan `--audit-selesai`.
"""

import argparse

import httpx

from agent import config as agent_config
from engine.format import angka

PENCATAT = "skenario uji selisih stok"


def _sku_target(client: httpx.Client, store: int, inventory_id: str | None) -> dict:
    if inventory_id:
        return client.get(f"/sku/{inventory_id}").raise_for_status().json()
    naik = client.get(f"/stores/{store}/prioritas", params={"limit_naik": 1, "limit_turun": 0}).json()["naik"]
    if not naik:
        raise RuntimeError(f"Tidak ada SKU 'naik' di toko {store}.")
    return client.get(f"/sku/{naik[0]['inventory_id']}").raise_for_status().json()


def catat_selisih(client: httpx.Client, store: int, susut: float, inventory_id: str | None = None,
                  cetak=print) -> dict:
    sku = _sku_target(client, store, inventory_id)
    stok_fisik = round(sku["stok_akhir"] * (1 - susut))
    hasil = client.post(f"/sku/{sku['inventory_id']}/stok-fisik", json={
        "stok_fisik": stok_fisik, "dicatat_oleh": PENCATAT,
        "catatan": f"Simulasi stock opname: {angka(susut * 100)}% stok sistem tidak ditemukan di rak/gudang",
    }).raise_for_status().json()
    cetak(f"{sku['deskripsi']} ({sku['inventory_id']}): stok sistem {hasil['stok_sistem']}, "
          f"hitung fisik {hasil['stok_fisik']} (selisih {hasil['selisih']}).")
    cetak(f"Data Confidence {angka(hasil['data_confidence_data'], 2)} -> {angka(hasil['data_confidence'], 2)}"
          f"{'; di bawah ambang, PO SKU ini ditahan sampai diaudit.' if hasil['perlu_audit'] else '.'}")
    cetak("Sekarang jalankan agent (dashboard atau `python -m agent.run`) untuk melihat guardrail bekerja.")
    return hasil


def audit_selesai(client: httpx.Client, store: int, cetak=print) -> int:
    daftar = client.get(f"/stores/{store}/stok-fisik").json()
    for c in daftar:
        client.delete(f"/sku/{c['inventory_id']}/stok-fisik", params={"oleh": "manajer (akhir skenario uji)"})
        cetak(f"Audit selesai: {c['deskripsi']}; Data Confidence kembali {angka(c['data_confidence_data'], 2)}.")
    if not daftar:
        cetak(f"Tidak ada hitung fisik yang menunggu audit di toko {store}.")
    return len(daftar)


def main() -> None:
    p = argparse.ArgumentParser(description="Skenario uji selisih stok (Data Confidence).")
    p.add_argument("--store", type=int, default=74)
    p.add_argument("--sku", help="inventory_id target (default: SKU 'naik' teratas di daftar prioritas)")
    p.add_argument("--susut", type=float, default=0.25, help="Porsi stok sistem yang tidak ditemukan (default 0,25)")
    p.add_argument("--audit-selesai", action="store_true", help="Hapus semua catatan hitung fisik toko ini")
    args = p.parse_args()
    with httpx.Client(base_url=agent_config.API_URL, timeout=30) as client:
        if args.audit_selesai:
            audit_selesai(client, args.store)
        else:
            catat_selisih(client, args.store, args.susut, args.sku)


if __name__ == "__main__":
    main()
