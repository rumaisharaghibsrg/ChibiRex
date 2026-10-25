/**
 * npc.js — Persona NPC Virtual HQ dan laporan mereka dari API Rexa.
 *
 * Setiap NPC mewakili satu bagian dashboard: Maya (hitung fisik dan Data Confidence), Citra (modal tertahan, Hold
 * Reorder, realokasi), Rian (guardrail dan circuit breaker), Pak Budi (Health Score dan peringkat jaringan). Semua
 * angka dibaca dari API; kalau API gagal, galatnya dilempar ke pemanggil, bukan diganti angka karangan.
 */

import { api } from './api';
import { angka, angka2, rupiah, rupiahRingkas, statusHealth } from './format';
import { formatIndonesianDate } from '../utils/TimeEngine';

export const PERSONA = {
    maya: {
        id: 'maya', name: 'Maya', role: 'Auditor Stok & Gudang', location: 'Area Hot-Desk & Arsip Gudang',
        avatar: '📦', badgeColor: '#f472b6',
    },
    citra: {
        id: 'citra', name: 'Citra', role: 'Financial Strategist', location: 'Meja Rapat War Room',
        avatar: '💼', badgeColor: '#fbbf24',
    },
    rian: {
        id: 'rian', name: 'Rian', role: 'Security & Guardrail Sentinel', location: 'Gerbang Server AI & Tech Rack',
        avatar: '🛡️', badgeColor: '#94a3b8',
    },
    budi: {
        id: 'budi', name: 'Pak Budi', role: 'Store Operations Director', location: 'Area Layar Smart Screen Eksekutif',
        avatar: '📊', badgeColor: '#38bdf8',
    },
    rexa: {
        id: 'rexa', name: 'Rexa', role: 'Agent AI Inventory & Cash Flow', location: 'Ruang Kerja Copilot (Kiri Atas)',
        avatar: '🤖', badgeColor: '#2dd4bf',
    },
};

const HIJAU = '#4ade80';
const KUNING = '#fbbf24';
const MERAH = '#f87171';
const BIRU = '#38bdf8';

const komponen = (ringkasan, kode) => ringkasan.komponen.find((k) => k.kode === kode);

async function laporanMaya(s) {
    const [fisik, guard] = await Promise.all([api.stokFisik(s), api.statusGuardrail(s)]);
    const perluAudit = fisik.filter((c) => c.perlu_audit);
    const terbesar = [...fisik].sort((a, b) => Math.abs(b.selisih) - Math.abs(a.selisih))[0];
    return {
        dialogue: fisik.length === 0
            ? `Belum ada hitung fisik yang menunggu audit di Toko ${s}. Data Confidence semua SKU masih dari riwayat ` +
              'data, jadi tidak ada PO yang ditahan karena selisih stok'
            : `Ada ${fisik.length} hitung fisik yang menunggu audit di Toko ${s}. Selisih terbesar: ${terbesar.deskripsi} ` +
              `(sistem ${terbesar.stok_sistem}, fisik ${terbesar.stok_fisik}). ${perluAudit.length} SKU di bawah ambang ` +
              `Data Confidence ${angka2(guard.data_confidence_min)}, jadi PO-nya ditahan sampai audit selesai`,
        metrics: [
            { label: 'Menunggu audit', value: `${fisik.length} SKU`, color: fisik.length ? KUNING : HIJAU },
            { label: 'PO ditahan (Data Confidence)', value: `${perluAudit.length} SKU`, color: perluAudit.length ? MERAH : HIJAU },
            {
                label: 'Data Confidence terendah',
                value: fisik.length ? angka2(Math.min(...fisik.map((c) => c.data_confidence))) : '-',
                color: BIRU,
            },
            { label: 'Ambang Data Confidence', value: angka2(guard.data_confidence_min), color: BIRU },
        ],
    };
}

async function laporanCitra(s) {
    const [r, realokasi] = await Promise.all([api.ringkasan(s), api.realokasi(s)]);
    const persen = r.nilai_stok_idr ? Math.round((100 * r.modal_tertahan_idr) / r.nilai_stok_idr) : 0;
    return {
        dialogue: `Modal tertahan di SKU overstock dan deadstock Toko ${s}: ${rupiahRingkas(r.modal_tertahan_idr)} ` +
            `(${persen}% dari nilai stok ${rupiahRingkas(r.nilai_stok_idr)}). Modal yang diselamatkan Hold Reorder: ` +
            `${rupiah(r.modal_diselamatkan_idr)}. ${realokasi.pesan}`,
        metrics: [
            { label: 'Modal diselamatkan (Hold)', value: rupiah(r.modal_diselamatkan_idr), color: HIJAU },
            { label: 'Modal tertahan', value: `${rupiahRingkas(r.modal_tertahan_idr)} (${persen}%)`, color: persen > 40 ? MERAH : KUNING },
            { label: 'Dana siap dialihkan', value: rupiah(realokasi.dana_tersedia_idr), color: BIRU },
            { label: 'Stok uji (Exploration)', value: rupiah(r.exploration_budget_idr), color: KUNING },
        ],
    };
}

async function laporanRian(s) {
    const g = await api.statusGuardrail(s);
    const total = g.total_po_hari_ini_idr ?? 0;
    return {
        dialogue: g.circuit_breaker_terbuka
            ? `Circuit breaker TERBUKA${g.alasan ? `: ${g.alasan}` : ''}. Semua PO baru ditahan sampai manajer ` +
              'mereset lewat Crisis Hub Doni atau dashboard'
            : `Circuit breaker tertutup; PO baru diproses normal. Total PO Toko ${s} hari ini ${rupiah(total)} dari batas ` +
              `${rupiah(g.batas_po_harian_idr)}. PO yang melebihi target stok + ${angka(g.outlier_sigma)}σ permintaan ditahan`,
        metrics: [
            {
                label: 'Circuit breaker',
                value: g.circuit_breaker_terbuka ? 'TERBUKA' : 'Tertutup (normal)',
                color: g.circuit_breaker_terbuka ? MERAH : HIJAU,
            },
            { label: 'Batas PO harian', value: rupiah(g.batas_po_harian_idr), color: BIRU },
            { label: 'Sisa kuota hari ini', value: rupiah(Math.max(0, g.batas_po_harian_idr - total)), color: HIJAU },
            { label: 'Ambang lonjakan', value: `${angka(g.outlier_sigma)}σ`, color: BIRU },
        ],
    };
}

async function laporanBudi(s) {
    // Statistik jaringan hanya untuk peringkat; kalau endpoint-nya belum ada, laporan tetap jalan tanpa peringkat.
    const [r, jaringan] = await Promise.all([api.ringkasan(s), api.jaringan().catch(() => null)]);
    const status = statusHealth(r.health_score);
    const terlemah = [...r.komponen].sort((a, b) => a.nilai - b.nilai)[0];
    const peringkat = jaringan ? 1 + jaringan.toko.filter((t) => t.health_score > r.health_score).length : null;
    return {
        dialogue: `Health Score Toko ${s} (${r.kota}) per ${formatIndonesianDate(r.per_tanggal)}: ${r.health_score}/100, ` +
            `${status.label.toLowerCase()}. Komponen terlemah ${terlemah.nama.toLowerCase()} (${angka(terlemah.nilai)}). ` +
            `${angka(r.jumlah_status.REORDER ?? 0)} SKU perlu reorder dan ${angka(r.sku_risiko_tinggi)} berisiko tinggi ` +
            'stok habis' +
            (peringkat ? `. Peringkat ${peringkat} dari ${jaringan.jumlah_toko} toko (rata-rata jaringan ${angka(jaringan.health_rata)})` : ''),
        metrics: [
            { label: 'Health Score', value: `${r.health_score} / 100`, color: status.warna },
            { label: 'Ketersediaan stok', value: angka(komponen(r, 'KETERSEDIAAN')?.nilai), color: BIRU },
            { label: 'Perputaran', value: angka(komponen(r, 'PERPUTARAN')?.nilai), color: BIRU },
            { label: 'Peringkat jaringan', value: peringkat ? `#${peringkat} dari ${jaringan.jumlah_toko}` : '-', color: KUNING },
        ],
    };
}

// ── Mode Semua Toko: laporan yang sama untuk seluruh jaringan (GET /jaringan/ringkasan dan /jaringan/transfer) ──

async function jaringanBudi() {
    const j = await api.jaringan();
    const urut = [...j.toko].sort((a, b) => a.health_score - b.health_score || a.store - b.store);
    const kritis = urut.filter((t) => t.health_score < 65);
    const sehat = j.toko.filter((t) => t.health_score >= 80).length;
    return {
        dialogue: `Health Score rata-rata ${j.jumlah_toko} toko per ${formatIndonesianDate(j.per_tanggal)}: ` +
            `${angka(j.health_rata)}. ${kritis.length} toko di zona merah (di bawah 65)` +
            (kritis.length ? `: ${kritis.slice(0, 4).map((t) => `Toko ${t.store} ${t.kota} (${t.health_score})`).join(', ')}` : '') +
            `. ${sehat} toko sehat (80 ke atas)`,
        metrics: [
            { label: 'Health rata-rata', value: `${angka(j.health_rata)} / 100`, color: statusHealth(j.health_rata).warna },
            { label: 'Toko kritis (< 65)', value: `${kritis.length} toko`, color: kritis.length ? MERAH : HIJAU },
            { label: 'Toko sehat (≥ 80)', value: `${sehat} toko`, color: HIJAU },
            { label: 'Terendah', value: urut.length ? `Toko ${urut[0].store} · ${urut[0].health_score}` : '-', color: KUNING },
        ],
    };
}

async function jaringanCitra() {
    const [j, t] = await Promise.all([api.jaringan(), api.transferJaringan(20).catch(() => null)]);
    const persen = j.nilai_stok_idr ? Math.round((100 * j.modal_tertahan_idr) / j.nilai_stok_idr) : 0;
    const top = t?.transfer?.[0];
    return {
        dialogue: `Modal tertahan di seluruh jaringan: ${rupiahRingkas(j.modal_tertahan_idr)} (${persen}% dari nilai stok ` +
            `${rupiahRingkas(j.nilai_stok_idr)}). Modal yang diselamatkan Hold Reorder: ${rupiah(j.modal_diselamatkan_idr)}. ` +
            (top
                ? `${t.transfer.length} transfer stok antar toko teratas bisa menghindari PO senilai ${rupiahRingkas(t.total_nilai_idr)}; ` +
                  `terbesar ${top.deskripsi} dari toko ${top.dari_toko} ke toko ${top.ke_toko} (${angka(top.qty)} unit, ` +
                  `${rupiahRingkas(top.nilai_idr)})`
                : 'Belum ada peluang transfer stok antar toko'),
        metrics: [
            { label: 'Modal tertahan (jaringan)', value: `${rupiahRingkas(j.modal_tertahan_idr)} (${persen}%)`, color: persen > 40 ? MERAH : KUNING },
            { label: 'Modal diselamatkan (Hold)', value: rupiah(j.modal_diselamatkan_idr), color: HIJAU },
            { label: 'PO bisa dihindari (transfer)', value: t ? rupiahRingkas(t.total_nilai_idr) : '-', color: BIRU },
            { label: 'Transfer terbesar', value: top ? `Toko ${top.dari_toko} → ${top.ke_toko}` : '-', color: KUNING },
        ],
    };
}

async function jaringanRian() {
    const [j, g] = await Promise.all([api.jaringan(), api.statusGuardrail()]);
    return {
        dialogue: (g.circuit_breaker_terbuka
            ? `Circuit breaker TERBUKA${g.alasan ? `: ${g.alasan}` : ''}. Semua PO baru di jaringan ditahan sampai manajer mereset`
            : 'Circuit breaker tertutup; PO baru diproses normal') +
            `. Draf PO yang menunggu persetujuan di seluruh jaringan: ${angka(j.po_menunggu)} (${rupiah(j.nilai_po_menunggu_idr)}). ` +
            `Batas PO harian ${rupiah(g.batas_po_harian_idr)} berlaku per toko`,
        metrics: [
            {
                label: 'Circuit breaker',
                value: g.circuit_breaker_terbuka ? 'TERBUKA' : 'Tertutup (normal)',
                color: g.circuit_breaker_terbuka ? MERAH : HIJAU,
            },
            { label: 'Draf PO menunggu', value: `${angka(j.po_menunggu)} PO`, color: j.po_menunggu ? KUNING : HIJAU },
            { label: 'Nilai draf PO', value: rupiah(j.nilai_po_menunggu_idr), color: BIRU },
            { label: 'Batas PO harian (per toko)', value: rupiah(g.batas_po_harian_idr), color: BIRU },
        ],
    };
}

async function jaringanMaya() {
    const j = await api.jaringan();
    const terbanyak = [...j.toko].sort((a, b) => b.perlu_reorder - a.perlu_reorder)[0];
    const overstock = j.toko.reduce((n, t) => n + t.overstock, 0);
    const deadstock = j.toko.reduce((n, t) => n + t.deadstock, 0);
    return {
        dialogue: `${angka(j.perlu_reorder)} SKU di ${j.jumlah_toko} toko perlu reorder; ${angka(j.sku_risiko_tinggi)} berisiko ` +
            `tinggi kehabisan stok. Reorder terbanyak di Toko ${terbanyak.store} ${terbanyak.kota} ` +
            `(${angka(terbanyak.perlu_reorder)} SKU). Di sisi lain ${angka(overstock)} SKU overstock dan ${angka(deadstock)} ` +
            'deadstock menahan modal',
        metrics: [
            { label: 'SKU perlu reorder', value: angka(j.perlu_reorder), color: KUNING },
            { label: 'Risiko tinggi stok habis', value: angka(j.sku_risiko_tinggi), color: MERAH },
            { label: 'Overstock', value: angka(overstock), color: BIRU },
            { label: 'Deadstock', value: angka(deadstock), color: MERAH },
        ],
    };
}

const LAPORAN = { maya: laporanMaya, citra: laporanCitra, rian: laporanRian, budi: laporanBudi };
const LAPORAN_JARINGAN = { maya: jaringanMaya, citra: jaringanCitra, rian: jaringanRian, budi: jaringanBudi };

/** Laporan staf untuk seluruh jaringan (mode Semua Toko): {dialogue, metrics}. Melempar ApiError kalau API gagal. */
export function laporanNpcJaringan(npcId) {
    const fungsi = LAPORAN_JARINGAN[npcId];
    if (!fungsi) return Promise.reject(new Error(`NPC ${npcId} tidak punya laporan data.`));
    return fungsi();
}

/** Laporan NPC untuk toko yang diawasi: {dialogue, metrics}. Melempar ApiError kalau API gagal. */
export function laporanNpc(npcId, storeId) {
    const fungsi = LAPORAN[npcId];
    if (!fungsi) return Promise.reject(new Error(`NPC ${npcId} tidak punya laporan data.`));
    return fungsi(storeId);
}
