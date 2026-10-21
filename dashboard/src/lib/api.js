// Klien REST API Rexa (backend FastAPI di folder api/). Kontrak per komponen: docs/api-dashboard.md.
// Alamat API diatur lewat VITE_API_URL di dashboard/.env.local; default-nya API lokal di port 8000.

export const API_URL = (import.meta.env?.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, kode, pesan, detail) {
    super(pesan);
    this.status = status;
    this.kode = kode;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', body, headers } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Browser melaporkan API mati dan penolakan CORS dengan galat yang sama, jadi sebutkan keduanya.
    throw new ApiError(0, 'API_TIDAK_TERJANGKAU',
      `API tidak bisa dihubungi di ${API_URL}. Pastikan API berjalan (lokal: "uvicorn api.main:app") dan domain ` +
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
  // Toko dan ringkasan
  stores: () => request('/stores'),
  ringkasan: (store) => request(`/stores/${store}/ringkasan`),
  prioritas: (store, params) => request(`/stores/${store}/prioritas${query(params)}`),
  realokasi: (store) => request(`/stores/${store}/reallocation`),

  // SKU
  daftarSku: (params) => request(`/sku${query(params)}`),
  sku: (inventoryId) => request(`/sku/${encodeURIComponent(inventoryId)}`),
  substitusi: (inventoryId) => request(`/sku/${encodeURIComponent(inventoryId)}/substitution`),

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

  // Agent
  mulaiAgent: (store, tugas) => request('/agent-runs/mulai', { method: 'POST', body: { store, tugas } }),
  statusAgent: (runId) => request(`/agent-runs/${runId}`),
  riwayatAgent: (limit = 10) => request(`/agent-runs${query({ limit })}`),
};
