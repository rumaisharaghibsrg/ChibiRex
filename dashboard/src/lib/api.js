// Klien REST API Rexa (backend FastAPI di folder api/). Kontrak per komponen: docs/api-dashboard.md.
// Alamat API diatur lewat VITE_API_URL di dashboard/.env.local; default-nya API lokal di port 8000.

export const API_URL = (import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
// Lambda Copilot (chatbot dengan Claude di Bedrock, copilot/ di repo). Kosong: chatbot menjawab cepat dari data saja.
export const COPILOT_URL = (import.meta.env?.VITE_COPILOT_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, kode, pesan, detail) {
    super(pesan);
    this.status = status;
    this.kode = kode;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', body, headers, base = API_URL } = {}) {
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Browser melaporkan API mati dan penolakan CORS dengan galat yang sama, jadi sebutkan keduanya.
    throw new ApiError(0, 'API_TIDAK_TERJANGKAU',
      `API tidak bisa dihubungi di ${base}. Pastikan API berjalan (lokal: "uvicorn api.main:app") dan domain ` +
      `dashboard ini diizinkan lewat CHIBIREX_CORS_ORIGINS di API.`);
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

const keputusan = (oleh, catatan) => ({ method: 'POST', body: { oleh, catatan } });

export const api = {
  // Jam simulasi: waktu maju dari 31 Des 2016 (data terakhir Bibitor)
  simulasi: () => request('/simulasi'),
  majuSimulasi: (hari, oleh) => request('/simulasi/maju', { method: 'POST', body: { hari, oleh } }),
  mundurSimulasi: (hari, oleh) => request('/simulasi/mundur', { method: 'POST', body: { hari, oleh } }),
  kembaliSimulasi: (oleh) => request('/simulasi/kembali', { method: 'POST', body: { oleh } }),
  otomatisSimulasi: (aktif, detikPerHari, oleh) => request('/simulasi/otomatis',
    { method: 'POST', body: { aktif, detik_per_hari: detikPerHari ?? null, oleh } }),

  // Toko dan ringkasan
  stores: () => request('/stores'),
  ringkasan: (store) => request(`/stores/${store}/ringkasan`),
  rekap: (store) => request(`/stores/${store}/rekap`),
  prioritas: (store, params) => request(`/stores/${store}/prioritas${query(params)}`),
  realokasi: (store) => request(`/stores/${store}/reallocation`),

  // SKU
  daftarSku: (params) => request(`/sku${query(params)}`),
  sku: (inventoryId) => request(`/sku/${encodeURIComponent(inventoryId)}`),
  substitusi: (inventoryId) => request(`/sku/${encodeURIComponent(inventoryId)}/substitution`),

  // Hitung fisik (stock opname) dan audit selisihnya
  stokFisik: (store) => request(`/stores/${store}/stok-fisik`),
  catatStokFisik: (inventoryId, body) => request(`/sku/${encodeURIComponent(inventoryId)}/stok-fisik`,
    { method: 'POST', body }),
  auditStokSelesai: (inventoryId, oleh) => request(`/sku/${encodeURIComponent(inventoryId)}/stok-fisik${query({ oleh })}`,
    { method: 'DELETE' }),

  // Purchase order dan 1-Click Approval
  daftarPo: (params) => request(`/purchase-orders${query(params)}`),
  po: (poId) => request(`/purchase-orders/${poId}`),
  payloadSap: (poId) => request(`/purchase-orders/${poId}/sap-payload`),
  setujuiPo: (poId, oleh, catatan) => request(`/purchase-orders/${poId}/approve`, keputusan(oleh, catatan)),
  tolakPo: (poId, oleh, catatan) => request(`/purchase-orders/${poId}/reject`, keputusan(oleh, catatan)),
  buatPo: (body) => request('/purchase-orders',
    { method: 'POST', body, headers: { 'Idempotency-Key': crypto.randomUUID() } }),

  // Hold Reorder, guardrail, audit
  holds: (store) => request(`/holds${query({ store })}`),
  statusGuardrail: (store) => request(`/guardrails/status${query({ store })}`),
  resetBreaker: (oleh, catatan) => request('/guardrails/circuit-breaker/reset', keputusan(oleh, catatan)),
  auditLog: (limit = 50) => request(`/audit-log${query({ limit })}`),

  // Copilot (Lambda terpisah): riwayat = [{peran: 'user'|'assistant', teks}]
  tanyaCopilot: (store, pertanyaan, riwayat) => request('/tanya',
    { method: 'POST', body: { store, pertanyaan, riwayat }, base: COPILOT_URL }),

  // Agent
  mulaiAgent: (store, tugas) => request('/agent-runs/mulai', { method: 'POST', body: { store, tugas } }),
  statusAgent: (runId) => request(`/agent-runs/${runId}`),
  agentAktif: () => request('/agent-runs/aktif'),
  statusWorker: () => request('/agent-runs/worker'),
  riwayatAgent: (limit = 10) => request(`/agent-runs${query({ limit })}`),
};
