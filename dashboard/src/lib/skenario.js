// Skenario uji guardrail yang dijalankan dari menu "Skenario Uji" di Header. Urutan panggilannya sama dengan versi
// terminal: agent/skenario_runaway.py dan agent/skenario_selisih_stok.py (lihat docs/api-dashboard.md).
import { api } from './api';

// Median lonjakan pesanan borongan di Online Retail II (tabel ringkasan_borongan di chibirex.duckdb).
export const RASIO_BORONGAN = 18.5;
const PEMBUAT_RUNAWAY = 'skenario uji Runaway PO';
const SUSUT = 0.25; // porsi stok sistem yang "tidak ditemukan" saat hitung fisik simulasi

// Sistem naif membaca lonjakan borongan sebagai tren permanen: 3 PO raksasa ditahan guardrail 3σ, circuit breaker
// terbuka, lalu PO normal pun ikut ditahan. Circuit breaker sengaja tidak direset otomatis: itu tugas manajer.
export async function ujiRunawayPo(store) {
  if ((await api.statusGuardrail(store)).circuit_breaker_terbuka) {
    throw new Error('Circuit breaker sudah terbuka. Reset dulu di menu Audit & Guardrails.');
  }
  const { naik } = await api.prioritas(store, { limit_naik: 10, limit_turun: 0 });
  if (!naik.length) throw new Error(`Tidak ada SKU dengan penjualan naik di toko ${store}.`);
  const draf = new Set((await api.daftarPo({ status: 'DRAFT', store })).map((p) => p.inventory_id));
  const bebas = naik.filter((s) => !draf.has(s.inventory_id));
  const kandidat = bebas.length ? bebas : naik;

  const hasil = [];
  for (let i = 0; i < 3; i++) {
    const sku = kandidat[i % kandidat.length];
    hasil.push(await api.buatPo({
      inventory_id: sku.inventory_id,
      qty: Math.min(Math.ceil(sku.saran_qty_po * RASIO_BORONGAN), 100_000),
      alasan: `Simulasi sistem naif: lonjakan borongan ${RASIO_BORONGAN}x dibaca sebagai tren permanen`,
      dibuat_oleh: PEMBUAT_RUNAWAY,
    }));
  }
  const sku = kandidat[3 % kandidat.length];
  hasil.push(await api.buatPo({
    inventory_id: sku.inventory_id, alasan: 'PO normal sesuai saran sistem', dibuat_oleh: PEMBUAT_RUNAWAY,
  }));
  return hasil;
}

// Hitung fisik (simulasi) SKU prioritas teratas yang 25% lebih kecil dari stok sistem: Data Confidence turun di bawah
// ambang, jadi PO SKU itu ditahan sampai manajer menandai audit selesai.
export async function simulasiSelisihStok(store, oleh) {
  const { naik } = await api.prioritas(store, { limit_naik: 1, limit_turun: 0 });
  if (!naik.length) throw new Error(`Tidak ada SKU dengan penjualan naik di toko ${store}.`);
  const sku = await api.sku(naik[0].inventory_id);
  return api.catatStokFisik(sku.inventory_id, {
    stok_fisik: Math.round(sku.stok_akhir * (1 - SUSUT)),
    dicatat_oleh: oleh,
    catatan: `Simulasi stock opname: ${SUSUT * 100}% stok sistem tidak ditemukan di rak/gudang`,
  });
}
