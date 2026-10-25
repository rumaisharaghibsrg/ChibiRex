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

const LAPORAN = { maya: laporanMaya, citra: laporanCitra, rian: laporanRian, budi: laporanBudi };

/** Laporan NPC untuk toko yang diawasi: {dialogue, metrics}. Melempar ApiError kalau API gagal. */
export function laporanNpc(npcId, storeId) {
    const fungsi = LAPORAN[npcId];
    if (!fungsi) return Promise.reject(new Error(`NPC ${npcId} tidak punya laporan data.`));
    return fungsi(storeId);
}
