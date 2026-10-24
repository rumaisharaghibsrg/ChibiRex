import { useEffect, useState } from 'react';
import { api } from './api';

// Kalau satu SKU punya beberapa PO, yang ditampilkan di tabel adalah yang paling perlu ditindak.
const URUTAN_PO = { DRAFT: 0, DITAHAN_GUARDRAIL: 1, APPROVED: 2, REJECTED: 3 };

// Baris Smart Reorder: SKU + PO + Hold Reorder aktif, digabung lewat inventory_id. SKU yang sudah ditindak agent
// ditaruh paling atas.
function gabungBaris(skus, poList, holds) {
  const poPerSku = new Map();
  for (const po of poList) {
    const lama = poPerSku.get(po.inventory_id);
    if (!lama || URUTAN_PO[po.status] < URUTAN_PO[lama.status]) poPerSku.set(po.inventory_id, po);
  }
  const holdPerSku = new Map();
  for (const h of holds) {
    if (h.status === 'AKTIF' && !holdPerSku.has(h.inventory_id)) holdPerSku.set(h.inventory_id, h);
  }
  const baris = skus.map((sku) => ({
    sku,
    po: poPerSku.get(sku.inventory_id) ?? null,
    hold: holdPerSku.get(sku.inventory_id) ?? null,
  }));
  return [...baris.filter((b) => b.po || b.hold), ...baris.filter((b) => !b.po && !b.hold)];
}

// Semua data satu toko untuk kartu dashboard. Dimuat ulang setiap `store` atau `refreshKey` berubah.
export function useDataToko(store, refreshKey) {
  const kunci = `${store}:${refreshKey}`;
  // Data lama tetap ditampilkan selama data baru dimuat; `memuat` benar sampai hasil untuk kunci ini datang.
  const [hasil, setHasil] = useState({ kunci: null, data: null, error: null });

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const [ringkasan, skuReorder, poList, holds, realokasi, guardrail, stokFisik] = await Promise.all([
          api.ringkasan(store),
          api.daftarSku({ store, status_stok: 'REORDER', limit: 50 }),
          api.daftarPo({ store }),
          api.holds(store),
          api.realokasi(store),
          api.statusGuardrail(store),
          api.stokFisik(store),
        ]);
        // SKU yang ditindak agent belum tentu masuk 50 besar nilai PO, jadi metriknya diambil terpisah.
        const ada = new Set(skuReorder.map((s) => s.inventory_id));
        const kurang = [...new Set([...poList, ...holds].map((x) => x.inventory_id))].filter((id) => !ada.has(id));
        const tambahan = await Promise.all(kurang.map((id) => api.sku(id)));
        if (batal) return;
        setHasil({
          kunci,
          data: {
            store, ringkasan, poList, holds, realokasi, guardrail, stokFisik,
            baris: gabungBaris([...tambahan, ...skuReorder], poList, holds),
          },
          error: null,
        });
      } catch (e) {
        if (!batal) setHasil((lama) => ({ kunci, data: lama.data, error: e }));
      }
    })();
    return () => { batal = true; };
  }, [kunci, store]);

  return { data: hasil.data, error: hasil.error, memuat: hasil.kunci !== kunci };
}
