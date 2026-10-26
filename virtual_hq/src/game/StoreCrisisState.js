/**
 * StoreCrisisState.js — Krisis toko untuk Crisis Command Hub Doni (Koordinator)
 *
 * Doni tidak mengarang krisis: deteksiKrisis() membaca API Rexa untuk toko yang diawasi dan hanya melaporkan kondisi
 * yang benar-benar ada, diurutkan dari yang paling parah:
 *  - Rian: circuit breaker terbuka (semua PO baru ditahan).
 *  - Pak Budi: Health Score di bawah 65 (zona merah dashboard).
 *  - Maya: SKU yang penjualannya naik dengan risiko stok habis TINGGI.
 *  - Citra: lebih dari 40% nilai stok tertahan di SKU overstock/deadstock (komponen stabilitas kas < 60).
 * Aksi resolusinya juga aksi asli: reset breaker oleh manajer, menugaskan Agent Rexa, atau membuka laporan Citra.
 * Hasil pemeriksaan terakhir disimpan per toko (hasilTerakhir) supaya panel Doni bisa dibuka lagi tanpa memeriksa ulang.
 */

import { EventBus } from './EventBus';
import { api } from '../lib/api';
import { angka, rupiah, rupiahRingkas } from '../lib/format';
import { formatIndonesianDate } from '../utils/TimeEngine';

// Kunci lama (cheat U+R+1..4 di MainScene) dipetakan ke NPC sumber krisisnya.
const KUNCI_KE_NPC = {
    CRISIS_STOCKOUT_FAST_MOVING: 'maya',
    CRISIS_DEADSTOCK_CASH_LOCK: 'citra',
    CRISIS_CIRCUIT_BREAKER_TRIPPED: 'rian',
    CRISIS_STORE_HEALTH_CRASH: 'budi',
};

const AMBANG_HEALTH = 65;
const AMBANG_STABILITAS_KAS = 60;

const hasilPerToko = new Map(); // toko (atau 'jaringan') -> {krisis, ringkas, tanggal}

/** Hasil pemeriksaan terakhir untuk toko ini (atau 'jaringan'), atau null kalau belum pernah diperiksa. */
export const hasilTerakhir = (kunci) => hasilPerToko.get(kunci) || null;

/**
 * Memeriksa data toko. Mengembalikan {krisis: [...], ringkas, tanggal}; krisis kosong berarti tidak ada kondisi darurat.
 * Melempar ApiError kalau API tidak terjangkau.
 */
export async function deteksiKrisis(store) {
    const s = store?.id || 74;
    const [r, g, p] = await Promise.all([
        api.ringkasan(s),
        api.statusGuardrail(s),
        api.prioritas(s, { limit_naik: 10, limit_turun: 0 }),
    ]);
    const krisis = [];

    if (g.circuit_breaker_terbuka) {
        krisis.push({
            crisisId: 'CRISIS_CIRCUIT_BREAKER_TRIPPED',
            sourceNPC: 'rian',
            sourceName: 'Rian (Guardrail Sentinel)',
            sourceLocation: 'Gerbang Server & Konsol Keamanan',
            title: 'CIRCUIT BREAKER TERBUKA',
            headline: `Semua PO baru Toko ${s} ditahan guardrail`,
            description: `${g.alasan || 'Guardrail mencatat pelanggaran beruntun.'} PO baru baru bisa dibuat lagi setelah ` +
                'manajer mereset circuit breaker.',
            metrics: { label: 'Status circuit breaker', currentValue: 'TERBUKA', thresholdValue: 'Tertutup (normal)', badgeColor: '#ef4444' },
            action: { jenis: 'reset-breaker', label: '⚡ Reset circuit breaker (keputusan manajer)' },
        });
    }

    const terlemah = [...r.komponen].sort((a, b) => a.nilai - b.nilai)[0];
    if (r.health_score < AMBANG_HEALTH) {
        krisis.push({
            crisisId: 'CRISIS_STORE_HEALTH_CRASH',
            sourceNPC: 'budi',
            sourceName: 'Pak Budi (Store Operations Director)',
            sourceLocation: 'Smart Screen Area Eksekutif',
            title: `HEALTH SCORE ${r.health_score} / 100`,
            headline: `Toko ${s} masuk zona merah`,
            description: `Komponen terlemah: ${terlemah.nama.toLowerCase()} ${angka(terlemah.nilai)}. ` +
                `${angka(r.jumlah_status.REORDER ?? 0)} SKU perlu reorder dan ${angka(r.sku_risiko_tinggi)} berisiko tinggi stok habis.`,
            metrics: { label: 'Health Score', currentValue: `${r.health_score} / 100`, thresholdValue: `Minimum ${AMBANG_HEALTH} (batas zona merah)`, badgeColor: '#dc2626' },
            store_id: s,
            action: {
                jenis: 'agent',
                label: '🤖 Tugaskan Agent Rexa meninjau toko ini',
                store_id: s,
                crisis_type: 'CRISIS_STORE_HEALTH_CRASH',
                tugas: `Audit menyeluruh Toko ${s}: Health Score rendah (${r.health_score}/100)`,
            },
        });
    }

    const kritis = p.naik.filter((x) => x.level_risiko === 'TINGGI').sort((a, b) => (b.skor_risiko ?? 0) - (a.skor_risiko ?? 0));
    if (kritis.length) {
        const x = kritis[0];
        const skuIds = kritis.map((item) => item.inventory_id);
        krisis.push({
            crisisId: 'CRISIS_STOCKOUT_FAST_MOVING',
            sourceNPC: 'maya',
            sourceName: 'Maya (Auditor Stok & Gudang)',
            sourceLocation: 'Meja Hot-Desk & Ruang Arsip',
            title: `STOK KRITIS: ${(x.deskripsi || x.inventory_id).toUpperCase()}`,
            headline: `${kritis.length} SKU yang penjualannya naik berisiko tinggi kehabisan stok`,
            description: `${x.deskripsi}: stok ${angka(x.stok_akhir)} unit di bawah reorder point ${angka(x.reorder_point)}, ` +
                `skor risiko ${x.skor_risiko}. Saran PO ${angka(x.saran_qty_po)} unit (${rupiah(x.nilai_saran_po_idr)}); ` +
                'agent menyusun drafnya, manajer yang menyetujui.',
            metrics: { label: 'Stok tersisa', currentValue: `${angka(x.stok_akhir)} unit`, thresholdValue: `Reorder point ${angka(x.reorder_point)} unit`, badgeColor: '#f97316' },
            store_id: s,
            sku_ids: skuIds,
            sku_list: kritis,
            action: {
                jenis: 'agent',
                label: '🤖 Tugaskan Agent Rexa menyusun draf PO',
                store_id: s,
                sku_ids: skuIds,
                crisis_type: 'CRISIS_STOCKOUT_FAST_MOVING',
                tugas: `Susun draf PO untuk ${kritis.length} SKU berisiko kehabisan stok di Toko ${s} (stok kritis terdeteksi oleh Maya)`,
            },
        });
    }

    const kas = r.komponen.find((k) => k.kode === 'STABILITAS_KAS');
    const persenTertahan = r.nilai_stok_idr ? Math.round((100 * r.modal_tertahan_idr) / r.nilai_stok_idr) : 0;
    if (kas && kas.nilai < AMBANG_STABILITAS_KAS) {
        krisis.push({
            crisisId: 'CRISIS_DEADSTOCK_CASH_LOCK',
            sourceNPC: 'citra',
            sourceName: 'Citra (Financial Strategist)',
            sourceLocation: 'Meja Rapat War Room',
            title: `MODAL TERTAHAN ${rupiahRingkas(r.modal_tertahan_idr).toUpperCase()}`,
            headline: `${persenTertahan}% nilai stok Toko ${s} ada di SKU overstock dan deadstock`,
            description: `${angka(r.jumlah_status.OVERSTOCK ?? 0)} SKU overstock dan ${angka(r.jumlah_status.DEADSTOCK ?? 0)} ` +
                `deadstock menahan ${rupiahRingkas(r.modal_tertahan_idr)} dari nilai stok ${rupiahRingkas(r.nilai_stok_idr)}.`,
            metrics: { label: 'Modal tertahan', currentValue: `${persenTertahan}% nilai stok`, thresholdValue: `Maks. ${100 - AMBANG_STABILITAS_KAS}% nilai stok`, badgeColor: '#eab308' },
            action: { jenis: 'npc', npcId: 'citra', label: '💼 Lihat laporan modal dan realokasi Citra' },
        });
    }

    const ringkas = `Health Score ${r.health_score}/100, circuit breaker ${g.circuit_breaker_terbuka ? 'terbuka' : 'tertutup'}, ` +
        `${angka(r.jumlah_status.REORDER ?? 0)} SKU perlu reorder, modal tertahan ${persenTertahan}% nilai stok.`;
    const hasil = {
        krisis: krisis.map((k) => ({ ...k, isCrisis: true, severity: 'CRITICAL', store: s })),
        ringkas,
        tanggal: formatIndonesianDate(r.per_tanggal),
    };
    hasilPerToko.set(s, hasil);
    return hasil;
}

/**
 * Mode Semua Toko: Doni memeriksa seluruh jaringan. Krisis: circuit breaker terbuka (berlaku untuk semua toko) dan
 * toko-toko dengan Health Score di bawah 65. Hasil disimpan dengan kunci 'jaringan'.
 */
export async function deteksiKrisisJaringan() {
    const [j, g] = await Promise.all([api.jaringan(), api.statusGuardrail()]);
    const krisis = [];
    if (g.circuit_breaker_terbuka) {
        krisis.push({
            crisisId: 'CRISIS_CIRCUIT_BREAKER_TRIPPED',
            sourceNPC: 'rian',
            sourceName: 'Rian (Guardrail Sentinel)',
            sourceLocation: 'Gerbang Server & Konsol Keamanan',
            title: 'CIRCUIT BREAKER TERBUKA',
            headline: 'Semua PO baru di seluruh jaringan ditahan guardrail',
            description: `${g.alasan || 'Guardrail mencatat pelanggaran beruntun.'} PO baru baru bisa dibuat lagi setelah ` +
                'manajer mereset circuit breaker.',
            metrics: { label: 'Status circuit breaker', currentValue: 'TERBUKA', thresholdValue: 'Tertutup (normal)', badgeColor: '#ef4444' },
            action: { jenis: 'reset-breaker', label: '⚡ Reset circuit breaker (keputusan manajer)' },
        });
    }
    const merah = [...j.toko].filter((t) => t.health_score < AMBANG_HEALTH)
        .sort((a, b) => a.health_score - b.health_score || a.store - b.store);
    if (merah.length) {
        const t = merah[0];
        krisis.push({
            crisisId: 'CRISIS_JARINGAN_MERAH',
            sourceNPC: 'budi',
            sourceName: 'Pak Budi (Store Operations Director)',
            sourceLocation: 'Smart Screen Area Eksekutif',
            title: `${merah.length} TOKO DI ZONA MERAH`,
            headline: `Health Score di bawah ${AMBANG_HEALTH}: ${merah.slice(0, 5).map((x) => `Toko ${x.store} (${x.health_score})`).join(', ')}`,
            description: `Terendah Toko ${t.store} ${t.kota}: ${t.health_score}/100, ${angka(t.perlu_reorder)} SKU perlu reorder, ` +
                `modal tertahan ${rupiahRingkas(t.modal_tertahan_idr)}. Agent Jaringan menetapkan urutan penanganan dan transfer stok.`,
            metrics: { label: 'Toko di zona merah', currentValue: `${merah.length} dari ${j.jumlah_toko}`, thresholdValue: `Health Score minimum ${AMBANG_HEALTH}`, badgeColor: '#dc2626' },
            action: { jenis: 'agent', label: '🤖 Jalankan Agent Jaringan' },
        });
    }
    const hasil = {
        krisis: krisis.map((k) => ({ ...k, isCrisis: true, severity: 'CRITICAL', store: 'jaringan' })),
        ringkas: `Health rata-rata ${angka(j.health_rata)}, ${merah.length} toko merah, circuit breaker ` +
            `${g.circuit_breaker_terbuka ? 'terbuka' : 'tertutup'}, ${angka(j.po_menunggu)} draf PO menunggu persetujuan.`,
        tanggal: formatIndonesianDate(j.per_tanggal),
    };
    hasilPerToko.set('jaringan', hasil);
    return hasil;
}

// Inisialisasi Default State
export const defaultCrisisState = {
    isCrisis: false,
    crisisId: null,
    severity: 'NORMAL',
    sourceNPC: null,
    sourceName: '',
    sourceLocation: '',
    title: 'Operasional Toko Normal',
    headline: 'Tidak ada krisis aktif',
    description: '',
    metrics: null,
    action: null,
    timestamp: Date.now(),
};

/**
 * Pemicu SFX Klaxon / Alarm Sintetis Web Audio API (Zero External Asset)
 */
export function playEmergencyKlaxonSFX() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();

        // Nada 1: 880 Hz (A5 - High Urgency) turun ke 587 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.22);

        gain1.gain.setValueAtTime(0.2, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.35);

        // Nada Pantul (Echo Beep) setelah 180ms
        setTimeout(() => {
            try {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(987.77, ctx.currentTime);
                gain2.gain.setValueAtTime(0.15, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + 0.25);
            } catch {
                // Abaikan jika context sudah close
            }
        }, 180);
    } catch (e) {
        console.warn('[Audio] SFX Klaxon tidak dapat diputar:', e);
    }
}

// Pasang Helper Global pada window
if (typeof window !== 'undefined') {
    if (!window.StoreCrisisState) {
        window.StoreCrisisState = { ...defaultCrisisState };
    }

    /**
     * Memeriksa data toko yang diawasi lalu mengaktifkan krisis teratas (atau krisis NPC tertentu untuk kunci cheat).
     * Mengembalikan krisis yang diaktifkan, atau null kalau datanya tidak menunjukkan krisis. Klaxon dibunyikan
     * MainScene saat menerima event store-crisis-triggered.
     */
    window.triggerStoreCrisis = async (kunci) => {
        const npc = KUNCI_KE_NPC[kunci];
        const { krisis } = window.CURRENT_MODE === 'jaringan' ? await deteksiKrisisJaringan() : await deteksiKrisis(window.CURRENT_STORE);
        const pilihan = npc ? krisis.find((k) => k.sourceNPC === npc) : krisis[0];
        if (!pilihan) return null;
        window.StoreCrisisState = { ...pilihan, timestamp: Date.now() };
        EventBus.emit('store-crisis-triggered', window.StoreCrisisState);
        window.dispatchEvent(new CustomEvent('store-crisis-triggered', { detail: window.StoreCrisisState }));
        return window.StoreCrisisState;
    };

    window.resolveStoreCrisis = () => {
        window.StoreCrisisState = {
            ...defaultCrisisState,
            timestamp: Date.now(),
        };
        EventBus.emit('store-crisis-resolved', window.StoreCrisisState);
        window.dispatchEvent(new CustomEvent('store-crisis-resolved', { detail: window.StoreCrisisState }));
        return window.StoreCrisisState;
    };

    window.playEmergencyKlaxonSFX = playEmergencyKlaxonSFX;
}
