/**
 * StoreCrisisState.js — Global Crisis Engine & State Management untuk Virtual HQ
 *
 * Mengelola status darurat operasional lintas divisi (Rian, Maya, Citra, Pak Budi)
 * dan menghubungkan perilaku AI Doni (Koordinator) dengan UI Crisis Command Hub.
 */

import { EventBus } from './EventBus';

export const CRISIS_PRESETS = {
    CRISIS_CIRCUIT_BREAKER_TRIPPED: {
        crisisId: 'CRISIS_CIRCUIT_BREAKER_TRIPPED',
        severity: 'CRITICAL',
        sourceNPC: 'rian',
        sourceName: 'Rian (Security & Guardrail Sentinel)',
        sourceLocation: 'Gerbang Server & Konsol Keamanan',
        title: 'CIRCUIT BREAKER TRIPPED!',
        headline: 'Sistem Pengaman Membekukan Seluruh Alur Pengadaan PO Toko',
        description: 'Terdeteksi lonjakan pesanan anomali 3.2-Sigma senilai Rp 58.200.000 yang melampaui batas harian Rp 50.000.000. Seluruh gateway penerbitan PO ke SAP S/4HANA terkunci otomatis.',
        metrics: {
            label: 'Nilai Transaksi Terdeteksi',
            currentValue: 'Rp 58.200.000',
            thresholdValue: 'Maks. Rp 50.000.000',
            badgeColor: '#ef4444',
        },
        action: {
            label: '⚡ Reset Circuit Breaker Sekarang',
            apiEndpoint: 'http://localhost:8000/guardrails/circuit-breaker/reset',
            apiMethod: 'POST',
            payload: { store: 74, reason: 'Manager Emergency Authorization' },
            successMessage: 'Circuit Breaker telah di-reset ke status NORMAL. Gateway SAP S/4HANA dibuka kembali!',
        },
    },
    CRISIS_STOCKOUT_FAST_MOVING: {
        crisisId: 'CRISIS_STOCKOUT_FAST_MOVING',
        severity: 'CRITICAL',
        sourceNPC: 'maya',
        sourceName: 'Maya (Auditor Stok & Gudang)',
        sourceLocation: 'Meja Hot-Desk & Ruang Arsip',
        title: 'CRITICAL STOCKOUT: ARABIKA SPECIALTY!',
        headline: 'Stok Fisik SKU Fast-Moving Utama Habis Total di Rak Toko',
        description: 'Stok fisik Kopi Arabika Specialty tercatat 0 unit di rak B-04 sementara laju konsumsi harian mencapai 28 botol/hari. Pelanggan mulai mengeluhkan kekosongan stok!',
        metrics: {
            label: 'Stok Fisik Tersedia',
            currentValue: '0 Botol (KOSONG)',
            thresholdValue: 'Safety Stock: 15 Botol',
            badgeColor: '#f97316',
        },
        action: {
            label: '📦 Otorisasi Restock Darurat (50 Karton)',
            apiEndpoint: 'http://localhost:8000/purchase-orders',
            apiMethod: 'POST',
            payload: { store: 74, sku: 'SKU-001', qty: 50, priority: 'EMERGENCY' },
            successMessage: 'Draf PO Darurat 50 Karton Arabika diterbitkan langsung ke antrean approval!',
        },
    },
    CRISIS_DEADSTOCK_CASH_LOCK: {
        crisisId: 'CRISIS_DEADSTOCK_CASH_LOCK',
        severity: 'CRITICAL',
        sourceNPC: 'citra',
        sourceName: 'Citra (Financial Strategist)',
        sourceLocation: 'Meja Rapat War Room',
        title: 'DEADSTOCK CAPITAL LOCK!',
        headline: 'Dana Mengendap di Produk Lambat Melebihi Batas Toleransi',
        description: 'Modal operasional toko tertahan sebesar Rp 18.500.000 pada SKU Sirup Hazelnut Gourmet yang perputarannya anjlok. Sisa kas lancar toko berada di bawah ambang batas likuiditas minimum.',
        metrics: {
            label: 'Modal Tertahan di Deadstock',
            currentValue: 'Rp 18.500.000',
            thresholdValue: 'Batas Toleransi: Rp 10.000.000',
            badgeColor: '#eab308',
        },
        action: {
            label: '💼 Eksekusi Realokasi Kas 100%',
            apiEndpoint: 'http://localhost:8000/stores/74/reallocation',
            apiMethod: 'GET',
            payload: {},
            successMessage: 'Modal Rp 18.500.000 berhasil diselamatkan dari deadstock dan dialokasikan ke produk laris!',
        },
    },
    CRISIS_STORE_HEALTH_CRASH: {
        crisisId: 'CRISIS_STORE_HEALTH_CRASH',
        severity: 'CRITICAL',
        sourceNPC: 'budi',
        sourceName: 'Pak Budi (Store Operations Director)',
        sourceLocation: 'Smart Screen Area Eksekutif',
        title: 'STORE HEALTH CRASH: 58.4 / 100!',
        headline: 'Skor Kesehatan Toko 74 Merosot ke Kategori Red Alert',
        description: 'Kombinasi keterlambatan pengiriman pemasok dan deviasi stok menurunkan Store Health Score Toko 74 ke level 58.4/100. Direksi Regional menandai Toko 74 dalam evaluasi darurat.',
        metrics: {
            label: 'Overall Health Score',
            currentValue: '58.4 / 100 (KRITIS)',
            thresholdValue: 'Standar Minimum: 80.0 / 100',
            badgeColor: '#dc2626',
        },
        action: {
            label: '📊 Terapkan Protokol Intervensi Operasional',
            apiEndpoint: 'http://localhost:8000/stores/74/ringkasan',
            apiMethod: 'GET',
            payload: {},
            successMessage: 'Protokol intervensi diterapkan. Health Score dipulihkan ke kategori Prima!',
        },
    },
};

// Inisialisasi Default State
export const defaultCrisisState = {
    isCrisis: false,
    crisisId: null,
    severity: 'NORMAL',
    sourceNPC: null,
    sourceName: '',
    sourceLocation: '',
    title: 'Operasional Toko Normal',
    headline: 'Semua divisi berjalan tertib dan aman',
    description: 'Tidak ada anomali atau krisis yang memerlukan tindakan darurat.',
    metrics: {
        label: 'Status Operasional',
        currentValue: 'Stabil & Terkendali',
        thresholdValue: 'Semua Parameter Normal',
        badgeColor: '#10b981',
    },
    action: {
        label: 'Tutup',
        apiEndpoint: '',
        apiMethod: 'GET',
        payload: {},
        successMessage: 'Operasional tetap normal.',
    },
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

    window.triggerStoreCrisis = (presetKey = 'CRISIS_CIRCUIT_BREAKER_TRIPPED') => {
        const preset = CRISIS_PRESETS[presetKey] || CRISIS_PRESETS.CRISIS_CIRCUIT_BREAKER_TRIPPED;
        window.StoreCrisisState = {
            isCrisis: true,
            ...preset,
            timestamp: Date.now(),
        };

        // Bunyikan Klaxon Darurat
        playEmergencyKlaxonSFX();

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
