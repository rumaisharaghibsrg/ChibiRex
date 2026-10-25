/**
 * NPCFallbackData.js — Multi-Tenant Dynamic Graceful Degradation Engine & Persona Registry
 *
 * Menyediakan utilitas fetch jaringan resilien dengan batas waktu timeout (AbortController),
 * fungsi generator dinamis persona NPC terparameterisasi per cabang toko dan simulasi waktu (daysOffset),
 * serta ES6 Proxy untuk backward compatibility.
 */

import { BASELINE_DATE, calculateNewDate, formatIndonesianDate } from './TimeEngine';

/**
 * Utilitas fetch aman dengan batas waktu timeout dan silent fallback handling
 * @param {string} url - Endpoint URL yang dituju
 * @param {object} options - Opsi request (headers, method, body, dsb)
 * @param {number} timeoutMs - Batas toleransi milidetik sebelum dibatalkan (default: 2500ms)
 * @returns {Promise<{ success: boolean, data?: any, error?: string, isFallback: boolean }>}
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Server merespons tidak normal`);
        }

        const data = await response.json();
        return { success: true, data, isFallback: false };
    } catch (err) {
        clearTimeout(timeoutId);
        const isTimeout = err.name === 'AbortError';
        const errorReason = isTimeout ? `Request Timeout (${timeoutMs}ms)` : err.message;
        console.warn(`[Graceful Degradation] Fetch gagal ke ${url} [${errorReason}]. Mengaktifkan Silent Fallback Data.`);
        return { success: false, error: errorReason, isFallback: true };
    }
}

/**
 * Generator Data Persona & Metrik NPC Dinamis Terparameterisasi Per Cabang Toko & Temporal Offset
 * @param {string} npcId - 'maya' | 'citra' | 'rian' | 'budi' | 'rexa'
 * @param {number|string} storeId - ID Cabang Toko aktif (default: 74)
 * @param {string} storeCity - Nama Kota / Label Cabang (default: 'PAENTMARWY')
 * @param {number} daysOffset - Offset hari dari baseline 31 Des 2016 (default: 0)
 */
export function getNPCFallback(npcId = 'maya', storeId = 74, storeCity = 'PAENTMARWY', daysOffset = 0) {
    const sId = parseInt(storeId, 10) || 74;
    const sName = storeCity || (typeof window !== 'undefined' && window.CURRENT_STORE?.city) || 'PAENTMARWY';
    const offset = typeof daysOffset === 'number'
        ? daysOffset
        : (typeof window !== 'undefined' && window.CURRENT_DAYS_OFFSET) || 0;

    const dateCalc = calculateNewDate(BASELINE_DATE, offset);
    const dateFormatted = dateCalc.formatted;

    const registry = {
        maya: {
            id: 'maya',
            name: 'Maya',
            role: 'Auditor Stok & Gudang',
            location: 'Area Hot-Desk & Arsip Gudang',
            avatar: '📦',
            badgeColor: '#f472b6',
            endpoint: `/stores/${sId}/stok-fisik`,
            sentence: offset === 0
                ? `Halo Manager! Baru saja saya selesai menyisir rak B-04 dan area kardus cadangan Toko ${sId} (${sName}). Audit rak gudang berjalan lancar, tidak ada selisih stok mayoritas barang. Seluruh batch produk tertata rapi sesuai standar FIFO dan siap didistribusikan.`
                : offset < 7
                ? `Halo Manager! Dalam mutasi harian per ${dateFormatted}, tercatat perputaran keluar ~180 unit stok di Toko ${sId} (${sName}). Opname harian mencatat 2 SKU memerlukan verifikasi batch lebih lanjut.`
                : `Manager, akumulasi operasional 7 hari per ${dateFormatted} menunjukkan variansi stok fisik vs sistem pada 7 SKU akibat tingginya perputaran rak di Toko ${sId}. Verifikasi opname mingguan disarankan segera.`,
            metrics: offset === 0
                ? [
                    { label: 'Status Opname', value: 'Terverifikasi (FIFO)', color: '#4ade80' },
                    { label: 'Data Confidence', value: '0.94 / 1.00', color: '#38bdf8' },
                    { label: 'Selisih Kritis', value: '0 SKU (Nol)', color: '#4ade80' },
                    { label: 'Cabang Audit', value: `Toko #${sId}`, color: '#f472b6' },
                ]
                : offset < 7
                ? [
                    { label: 'Status Opname', value: '2 Perlu Verifikasi', color: '#fbbf24' },
                    { label: 'Data Confidence', value: '0.91 / 1.00', color: '#38bdf8' },
                    { label: 'Selisih Kritis', value: '2 SKU', color: '#fbbf24' },
                    { label: 'Tanggal Audit', value: dateFormatted, color: '#f472b6' },
                ]
                : [
                    { label: 'Status Opname', value: '7 Perlu Verifikasi', color: '#f87171' },
                    { label: 'Data Confidence', value: '0.84 / 1.00', color: '#fbbf24' },
                    { label: 'Selisih Kritis', value: '7 SKU', color: '#f87171' },
                    { label: 'Siklus Audit', value: `Mingguan (${dateFormatted})`, color: '#f472b6' },
                ],
            actionLabel: '📦 Buka Lembar Audit Lengkap',
        },
        citra: {
            id: 'citra',
            name: 'Citra',
            role: 'Financial Strategist',
            location: 'Meja Rapat War Room',
            avatar: '💼',
            badgeColor: '#fbbf24',
            endpoint: `/stores/${sId}/reallocation`,
            sentence: offset === 0
                ? `Selamat siang, Manager! Saya baru saja meninjau neraca belanja minggu ini untuk Toko ${sId} (${sName}). Likuiditas kas berada dalam batas aman. Alokasi belanja terkendali dan modal operasional terhindar dari deadstock produk lambat.`
                : offset < 7
                ? `Selamat siang, Manager! Evaluasi likuiditas harian per ${dateFormatted} untuk Toko ${sId} (${sName}) menunjukkan perputaran modal lancar. Kas aman di angka Rp 21.300.000 berkat pembekuan PO deadstock.`
                : `Manager, penutupan neraca mingguan per ${dateFormatted} di Toko ${sId} berhasil mengamankan Rp 38.600.000 dari risiko pembelian inventaris lambat. Exploratory budget 10% siap dialokasikan untuk siklus belanja minggu depan.`,
            metrics: offset === 0
                ? [
                    { label: 'Kas Diselamatkan', value: 'Rp 18.500.000', color: '#4ade80' },
                    { label: 'Exploratory Budget', value: '10% (Aktif)', color: '#fbbf24' },
                    { label: 'Rasio Likuiditas', value: '1.42 (Sehat)', color: '#38bdf8' },
                    { label: 'Cabang Kas', value: `Toko #${sId}`, color: '#fbbf24' },
                ]
                : offset < 7
                ? [
                    { label: 'Kas Diselamatkan', value: 'Rp 21.300.000', color: '#4ade80' },
                    { label: 'Exploratory Budget', value: '10% (Aktif)', color: '#fbbf24' },
                    { label: 'Rasio Likuiditas', value: '1.45 (Sehat)', color: '#38bdf8' },
                    { label: 'Evaluasi Kas', value: dateFormatted, color: '#fbbf24' },
                ]
                : [
                    { label: 'Kas Diselamatkan', value: 'Rp 38.600.000', color: '#4ade80' },
                    { label: 'Exploratory Budget', value: '10% (Siap Alokasi)', color: '#38bdf8' },
                    { label: 'Rasio Likuiditas', value: '1.48 (Prima)', color: '#34d399' },
                    { label: 'Neraca Mingguan', value: `Tutup ${dateFormatted}`, color: '#fbbf24' },
                ],
            actionLabel: '💼 Tinjau Alokasi Modal Kas',
        },
        rian: {
            id: 'rian',
            name: 'Rian',
            role: 'Security & Compliance Sentinel',
            location: 'Gerbang Server AI & Tech Rack',
            avatar: '🛡️',
            badgeColor: '#94a3b8',
            endpoint: `/guardrails/status?store=${sId}`,
            sentence: offset === 0
                ? `Lapor, Manager. Pemantauan gerbang server Toko ${sId} dan jalur transmisi SAP menunjukkan kondisi stabil. Sistem Guardrail beroperasi dalam parameter normal. Seluruh filter transaksi aktif dan Circuit Breaker dalam posisi aman.`
                : offset < 7
                ? `Sistem aman, Manager. Memasuki hari baru ${dateFormatted}, kuota transaksi PO harian SAP S/4HANA untuk Toko ${sId} telah di-refresh ke Rp 50.000.000. Gateway integrasi stabil.`
                : `Laporan audit mingguan keamanan ${dateFormatted} untuk Toko ${sId}: 0 insiden anomali 3-sigma terdeteksi selama 7 hari siklus. Circuit breaker tetap dalam status siaga proteksi penuh.`,
            metrics: offset === 0
                ? [
                    { label: 'Circuit Breaker', value: 'NORMAL (TERTUTUP)', color: '#4ade80' },
                    { label: 'Batas PO Harian', value: 'Rp 50.000.000', color: '#38bdf8' },
                    { label: 'Sisa Kuota Belanja', value: 'Rp 36.321.120', color: '#4ade80' },
                    { label: 'Proteksi Cabang', value: `Toko #${sId}`, color: '#94a3b8' },
                ]
                : offset < 7
                ? [
                    { label: 'Circuit Breaker', value: 'NORMAL (TERTUTUP)', color: '#4ade80' },
                    { label: 'Batas PO Harian', value: 'Rp 50.000.000', color: '#38bdf8' },
                    { label: 'Sisa Kuota Belanja', value: 'Rp 50.000.000 (Reset)', color: '#4ade80' },
                    { label: 'Siklus Guardrail', value: dateFormatted, color: '#94a3b8' },
                ]
                : [
                    { label: 'Circuit Breaker', value: 'NORMAL (TERTUTUP)', color: '#4ade80' },
                    { label: 'Anomali 7 Hari', value: '0 Terdeteksi (Aman)', color: '#4ade80' },
                    { label: 'Sisa Kuota Belanja', value: 'Rp 44.150.000', color: '#38bdf8' },
                    { label: 'Audit Mingguan', value: dateFormatted, color: '#94a3b8' },
                ],
            actionLabel: '🛡️ Status Guardrail & Gateway',
        },
        budi: {
            id: 'budi',
            name: 'Pak Budi',
            role: 'Store Operations Director',
            location: 'Area Layar Smart Screen Eksekutif',
            avatar: '📊',
            badgeColor: '#38bdf8',
            endpoint: `/stores/${sId}/ringkasan`,
            sentence: offset === 0
                ? `Kerja bagus untuk seluruh tim toko hari ini, Manager! Evaluasi operasional harian Toko ${sId} (${sName}) menunjukkan tren yang sangat memuaskan. Store Health Score kita berada di zona prima dan seluruh divisi bekerja selaras.`
                : offset < 7
                ? `Evaluasi harian ${dateFormatted} untuk Toko ${sId} (${sName}): Ketersediaan rak bertahan pada 94% dengan skor kesehatan 91.8. Kinerja harian tim berada di koridor optimal.`
                : `Perhatian Manager! Tinjauan mingguan per ${dateFormatted} di Toko ${sId} mendeteksi penurunan ketersediaan rak menjadi 88% akibat beberapa SKU mencapai titik reorder kritis. Segera terbitkan PO baru agar skor kesehatan tidak anjlok ke zona bahaya!`,
            metrics: offset === 0
                ? [
                    { label: 'Store Health Score', value: '92.4 / 100 (Prima)', color: '#4ade80' },
                    { label: 'Ketersediaan Rak', value: '95%', color: '#38bdf8' },
                    { label: 'Perputaran Stok', value: '89%', color: '#38bdf8' },
                    { label: 'Peringkat Regional', value: `#2 Regional (${sName})`, color: '#fbbf24' },
                ]
                : offset < 7
                ? [
                    { label: 'Store Health Score', value: '91.8 / 100 (Prima)', color: '#4ade80' },
                    { label: 'Ketersediaan Rak', value: '94%', color: '#38bdf8' },
                    { label: 'Perputaran Stok', value: '88%', color: '#38bdf8' },
                    { label: 'Laporan Harian', value: dateFormatted, color: '#fbbf24' },
                ]
                : [
                    { label: 'Store Health Score', value: '87.5 / 100 (Perhatian)', color: '#fbbf24' },
                    { label: 'Ketersediaan Rak', value: '88%', color: '#fbbf24' },
                    { label: 'Item Reorder', value: '7 SKU Perlu PO', color: '#f87171' },
                    { label: 'Peringkat Regional', value: `#4 Regional (${sName})`, color: '#fbbf24' },
                ],
            actionLabel: '📊 Buka Dashboard Eksekutif',
        },
        rexa: {
            id: 'rexa',
            name: 'Rexa',
            role: 'Autonomous AI Inventory Copilot',
            location: 'Ruang Kerja Copilot (Kiri Atas)',
            avatar: '🤖',
            badgeColor: '#2dd4bf',
            endpoint: '/agent-runs/mulai',
            sentence: offset === 0
                ? `Halo Manager! Saya telah memindai seluruh data telemetri inventaris Toko ${sId} (${sName}). Analisis komprehensif selesai. Pola konsumsi pelanggan stabil dan rekomendasi draf pengadaan siap ditinjau di Meja Manajer.`
                : offset < 7
                ? `Halo Manager! Pemindaian inventaris 24 jam terakhir per ${dateFormatted} mendeteksi percepatan permintaan pelanggan di Toko ${sId}. AI menyarankan penambahan kuota restock harian.`
                : `Manager, siklus evaluasi AI 7 hari per ${dateFormatted} menemukan 7 SKU mendekati stockout di Toko ${sId}. Rekomendasi batch PO mingguan telah dibuat dan menunggu persetujuan Anda di Meja Manajer.`,
            metrics: offset === 0
                ? [
                    { label: 'Siklus Penalaran', value: 'Selesai (6/6 Langkah)', color: '#4ade80' },
                    { label: 'Draf Rekomendasi', value: `PO-${sId}-RESTOCK-50`, color: '#38bdf8' },
                    { label: 'Target Cabang', value: `Toko #${sId} (${sName})`, color: '#2dd4bf' },
                    { label: 'Status Approval', value: 'Siap Ditinjau Mgr', color: '#fbbf24' },
                ]
                : offset < 7
                ? [
                    { label: 'Siklus Penalaran', value: 'Selesai (6/6 Langkah)', color: '#4ade80' },
                    { label: 'Draf Rekomendasi', value: `PO-${sId}-RESTOCK-65`, color: '#38bdf8' },
                    { label: 'Evaluasi Harian', value: dateFormatted, color: '#2dd4bf' },
                    { label: 'Status Approval', value: 'Siap Ditinjau Mgr', color: '#fbbf24' },
                ]
                : [
                    { label: 'Siklus Penalaran', value: 'Selesai (6/6 Langkah)', color: '#4ade80' },
                    { label: 'Draf Rekomendasi', value: `PO-${sId}-WEEKLY-RESTOCK`, color: '#38bdf8' },
                    { label: 'Batch Mingguan', value: `7 SKU (${dateFormatted})`, color: '#f87171' },
                    { label: 'Status Approval', value: 'Perlu Approval Segera', color: '#fbbf24' },
                ],
            actionLabel: '🤖 Jalankan Siklus Penalaran AI',
        },
    };

    const key = String(npcId).toLowerCase();
    return registry[key] || registry.maya;
}

/**
 * ES6 Proxy Layer untuk Backward Compatibility
 * Memastikan pemanggilan legacy `NPC_FALLBACK_REGISTRY[id]` otomatis mengevaluasi cabang aktif dan daysOffset di runtime
 */
export const NPC_FALLBACK_REGISTRY = new Proxy({}, {
    get(target, prop) {
        if (typeof prop !== 'string') return undefined;
        const activeStore = (typeof window !== 'undefined' && window.CURRENT_STORE) || { id: 74, city: 'PAENTMARWY' };
        const storeId = activeStore.id || activeStore.store || 74;
        const storeCity = activeStore.city || activeStore.kota || 'PAENTMARWY';
        const offset = (typeof window !== 'undefined' && window.CURRENT_DAYS_OFFSET) || 0;
        return getNPCFallback(prop, storeId, storeCity, offset);
    },
});

export default {
    fetchWithTimeout,
    getNPCFallback,
    NPC_FALLBACK_REGISTRY,
};
