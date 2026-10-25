/**
 * Klien REST API Rexa untuk Virtual HQ: API yang sama dengan dashboard, jadi angka di game dan dashboard selalu sama.
 * Alamat diatur lewat VITE_API_URL (default API lokal port 8000) dan VITE_COPILOT_URL (Lambda Copilot; kosong berarti
 * chat menjawab dari data API tanpa LLM). Kontrak endpoint: docs/api-dashboard.md di root repo.
 */

import { EventBus } from '../game/EventBus';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export const COPILOT_URL = (import.meta.env.VITE_COPILOT_URL || '').replace(/\/$/, '');

// Dashboard Rexa: di Amplify, Virtual HQ dipasang di /hq/ pada domain yang sama (deploy/deploy_dashboard.ps1), jadi
// '../' kembali ke dashboard; saat pengembangan, dashboard berjalan di Vite port 5173.
export const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || (import.meta.env.DEV ? 'http://localhost:5173/' : '../');
export const urlDashboard = (store) => `${DASHBOARD_URL}?store=${store}`;

// Nama yang tercatat di audit log API untuk keputusan dari game.
export const OLEH = 'Manajer (Virtual HQ)';

export class ApiError extends Error {
    constructor(status, kode, pesan, detail) {
        super(pesan);
        this.status = status;
        this.kode = kode;
        this.detail = detail;
    }
}

// Lambda API bisa cold start 5-8 detik, jadi batas waktunya longgar.
async function request(path, { method = 'GET', body, headers, base = API_URL, timeoutMs = 20000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
        res = await fetch(`${base}${path}`, {
            method,
            headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
    } catch (e) {
        if (e.name === 'AbortError') {
            throw new ApiError(0, 'WAKTU_HABIS', `API tidak menjawab dalam ${timeoutMs / 1000} detik.`);
        }
        // Browser melaporkan API mati dan penolakan CORS dengan galat yang sama, jadi sebutkan keduanya.
        throw new ApiError(0, 'API_TIDAK_TERJANGKAU',
            `API tidak bisa dihubungi di ${base}. Pastikan API berjalan dan alamat game ini diizinkan CORS.`);
    } finally {
        clearTimeout(timer);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const detail = data?.detail;
        // Galat bisnis dari API berbentuk {"detail": {"kode": ..., "pesan": ...}}; galat validasi berupa list.
        if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
            throw new ApiError(res.status, detail.kode, detail.pesan, detail);
        }
        throw new ApiError(res.status, `HTTP_${res.status}`,
            Array.isArray(detail) ? 'Data yang dikirim tidak valid.' : `Permintaan gagal (HTTP ${res.status}).`, detail);
    }
    return data;
}

function query(params = {}) {
    const isi = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    return isi.length ? `?${new URLSearchParams(isi)}` : '';
}

const keputusan = (catatan) => ({ method: 'POST', body: { oleh: OLEH, catatan } });

export const api = {
    // Jam simulasi (sama dengan kontrol tanggal di dashboard)
    simulasi: () => request('/simulasi'),
    majuSimulasi: (hari) => request('/simulasi/maju', { method: 'POST', body: { hari, oleh: OLEH } }),
    mundurSimulasi: (hari) => request('/simulasi/mundur', { method: 'POST', body: { hari, oleh: OLEH } }),
    kembaliSimulasi: () => request('/simulasi/kembali', { method: 'POST', body: { oleh: OLEH } }),

    // Toko dan jaringan
    stores: () => request('/stores'),
    jaringan: () => request('/jaringan/ringkasan'),
    ringkasan: (store) => request(`/stores/${store}/ringkasan`),
    prioritas: (store, params) => request(`/stores/${store}/prioritas${query(params)}`),
    realokasi: (store) => request(`/stores/${store}/reallocation`),
    stokFisik: (store) => request(`/stores/${store}/stok-fisik`),

    // Guardrail dan PO
    statusGuardrail: (store) => request(`/guardrails/status${query({ store })}`),
    resetBreaker: (catatan) => request('/guardrails/circuit-breaker/reset', keputusan(catatan)),
    daftarPo: (params) => request(`/purchase-orders${query(params)}`),
    payloadSap: (poId) => request(`/purchase-orders/${poId}/sap-payload`),
    setujuiPo: (poId, catatan) => request(`/purchase-orders/${poId}/approve`, keputusan(catatan)),
    tolakPo: (poId, catatan) => request(`/purchase-orders/${poId}/reject`, keputusan(catatan)),

    // Agent Rexa (worker di laptop, mode antrian)
    mulaiAgent: (store) => request('/agent-runs/mulai', { method: 'POST', body: { store } }),
    statusAgent: (runId) => request(`/agent-runs/${runId}`),
    agentAktif: () => request('/agent-runs/aktif'),
    riwayatAgent: (limit = 30) => request(`/agent-runs${query({ limit })}`),
    statusWorker: () => request('/agent-runs/worker'),

    // Copilot (Lambda terpisah): riwayat = [{peran: 'user'|'assistant', teks}]
    tanyaCopilot: (store, pertanyaan, riwayat) => request('/tanya',
        { method: 'POST', body: { store, pertanyaan, riwayat }, base: COPILOT_URL, timeoutMs: 60000 }),
};

// Data toko berubah (hari simulasi, agent selesai, PO diputuskan, breaker direset): panel yang terbuka memuat ulang.
export const DATA_BERUBAH = 'rexa-data-berubah';
export const beritahuDataBerubah = () => EventBus.emit(DATA_BERUBAH);
