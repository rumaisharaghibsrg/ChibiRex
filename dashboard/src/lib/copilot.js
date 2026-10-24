// Jawaban cepat Copilot dari data dashboard (useDataToko), tanpa LLM: pertanyaan dicocokkan dengan kata kunci, lalu
// angkanya diambil dari data yang sama dengan kartu dashboard. Dipakai kalau Lambda Copilot (Claude di Bedrock, folder
// copilot/) belum di-deploy atau sedang gagal.
import { angka, angka2, rupiah, tanggal } from './format';

export const quickPrompts = [
  { id: 'modal', title: 'Modal Diselamatkan', query: 'Berapa modal yang diselamatkan dari Hold Reorder?' },
  { id: 'po', title: 'Draf PO Menunggu', query: 'Draf PO apa saja yang menunggu persetujuan?' },
  { id: 'hold', title: 'Alasan Hold Reorder', query: 'Kenapa SKU ini masuk Hold Reorder?' },
  { id: 'realokasi', title: 'Realokasi Modal', query: 'Ke mana modal yang diselamatkan sebaiknya dialihkan?' },
  { id: 'risiko', title: 'Risiko Stok Habis', query: 'SKU mana yang paling berisiko kehabisan stok?' },
  { id: 'health', title: 'Health Score', query: 'Bagaimana Inventory Health Score toko ini dihitung?' },
  { id: 'guardrail', title: 'Status Guardrail', query: 'Bagaimana status guardrail sekarang?' },
];

const KATA_KUNCI = [
  ['realokasi', /realokasi|alih|pindah/],
  ['hold', /hold|tahan|suppress/],
  ['po', /\bpo\b|purchase|approval|setuju|draf/],
  ['modal', /modal|selamat|hemat|kas/],
  ['risiko', /habis|stockout|risiko|kosong/],
  ['health', /health|sehat|skor|score/],
  ['guardrail', /guardrail|breaker|audit|aman|confidence/],
];

const JAWABAN = {
  modal: ({ ringkasan, holds }) => {
    const aktif = holds.filter((h) => h.status === 'AKTIF');
    if (!aktif.length) {
      return `Belum ada modal yang diselamatkan di toko ${ringkasan.store}: belum ada Hold Reorder. Jalankan agent dari panel Agent Rexa.`;
    }
    return `Modal yang diselamatkan di toko ${ringkasan.store}: **${rupiah(ringkasan.modal_diselamatkan_idr)}** dari ${aktif.length} Hold Reorder aktif.\n\n` +
      aktif.slice(0, 3).map((h) => `• ${h.deskripsi}: ${rupiah(h.modal_diselamatkan_idr)}`).join('\n') +
      `\n\nSebagai pembanding, modal yang tertahan di SKU overstock/deadstock: ${rupiah(ringkasan.modal_tertahan_idr)}.`;
  },
  po: ({ poList }) => {
    const draf = poList.filter((p) => p.status === 'DRAFT');
    const ditahan = poList.filter((p) => p.status === 'DITAHAN_GUARDRAIL');
    if (!draf.length && !ditahan.length) return 'Tidak ada draf PO yang menunggu persetujuan. Jalankan agent untuk menyusun draf PO.';
    return (draf.length
      ? `**${draf.length} draf PO** menunggu 1-Click Approval:\n\n` +
        draf.slice(0, 4).map((p) => `• ${p.deskripsi}: ${angka(p.qty)} unit, ${rupiah(p.nilai_idr)}`).join('\n')
      : 'Tidak ada draf PO yang menunggu persetujuan.') +
      (ditahan.length ? `\n\n${ditahan.length} PO lain **ditahan guardrail** dan tidak bisa disetujui.` : '') +
      '\n\nTidak ada PO yang dikirim ke SAP sebelum disetujui manajer.';
  },
  hold: ({ holds }) => {
    const aktif = holds.filter((h) => h.status === 'AKTIF');
    if (!aktif.length) return 'Belum ada SKU yang masuk Hold Reorder di toko ini.';
    return aktif.slice(0, 3).map((h) =>
      `**${h.deskripsi}**: ${h.alasan}\n` +
      `Stok uji ${angka(h.qty_uji)} unit tetap dibeli; ditinjau ulang ${tanggal(h.review_pada)}.`
    ).join('\n\n');
  },
  realokasi: ({ realokasi }) => realokasi.pesan,
  risiko: ({ baris }) => {
    const teratas = [...baris].sort((a, b) => (b.sku.skor_risiko ?? 0) - (a.sku.skor_risiko ?? 0)).slice(0, 3);
    if (!teratas.length) return 'Tidak ada SKU yang perlu reorder di toko ini.';
    return 'SKU dengan skor risiko stok habis tertinggi (model LightGBM, indikatif):\n\n' +
      teratas.map(({ sku }) =>
        `• ${sku.deskripsi}: skor ${sku.skor_risiko} (${sku.level_risiko}), stok ${angka(sku.stok_akhir)} unit, ` +
        `${sku.hari_cukup === null ? '' : sku.hari_cukup < 1 ? 'sudah habis' : `cukup ${angka(sku.hari_cukup)} hari`}`
      ).join('\n');
  },
  health: ({ ringkasan }) =>
    `Inventory Health Score toko ${ringkasan.store}: **${ringkasan.health_score}/100** (data per ${tanggal(ringkasan.per_tanggal)}). ` +
    `${ringkasan.rumus}:\n\n` +
    ringkasan.komponen.map((k) => `• ${k.nama}: ${angka(k.nilai)} (${k.penjelasan})`).join('\n'),
  guardrail: ({ guardrail, stokFisik }) =>
    (guardrail.circuit_breaker_terbuka
      ? `**Circuit breaker terbuka**: semua PO baru ditahan sampai manajer mereset. ${guardrail.alasan ?? ''}`
      : 'Circuit breaker tertutup; PO baru diproses normal.') +
    `\n\nTotal PO hari ini ${rupiah(guardrail.total_po_hari_ini_idr ?? 0)} dari batas ${rupiah(guardrail.batas_po_harian_idr)}. ` +
    `Ambang Data Confidence ${angka2(guardrail.data_confidence_min)}.` +
    (stokFisik.length ? `\n\n${stokFisik.length} hitung fisik menunggu audit.` : ''),
};

export function jawab(query, data) {
  if (!data) return { text: 'Data toko belum termuat. Coba lagi sebentar lagi.', tag: 'Menunggu data' };
  const q = query.toLowerCase();
  const prompt = quickPrompts.find((p) => p.query === query);
  const topik = prompt?.id ?? KATA_KUNCI.find(([, pola]) => pola.test(q))?.[0];
  if (!topik) {
    return {
      text: 'Copilot ini belum memakai LLM; ia menjawab dari data API untuk topik: modal, draf PO, Hold Reorder, ' +
        'realokasi, risiko stok habis, Health Score, dan guardrail. Coba salah satu pertanyaan cepat di bawah.',
      tag: 'Topik belum dikenali',
    };
  }
  return { text: JAWABAN[topik](data), tag: `Data API · toko ${data.store}` };
}
