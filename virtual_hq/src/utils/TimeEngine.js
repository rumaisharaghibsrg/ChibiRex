/**
 * TimeEngine.js — Core Temporal Logic & Calculation Engine
 *
 * Mengelola kalkulasi simulasi waktu ChibiRex:
 *  - Basis data snapshot Bibitor per 31 Desember 2016 (2016-12-31).
 *  - Penambahan hari (+1 Hari harian, +7 Hari mingguan) dan operasi reset.
 *  - Pemformatan tanggal lokal Indonesia (ID).
 */

export const BASELINE_DATE_STR = '2016-12-31';
export const BASELINE_DATE = new Date('2016-12-31T00:00:00Z');

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];
const MONTHS_ID_FULL = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

/**
 * Format tanggal pendek bahasa Indonesia: "31 Des 2016"
 */
export function formatIndonesianDate(dateInput) {
    if (!dateInput) return '31 Des 2016';
    const d = new Date(dateInput);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTHS_ID[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
}

/**
 * Format tanggal lengkap dengan hari: "Sabtu, 31 Desember 2016"
 */
export function formatIndonesianDayAndDate(dateInput) {
    if (!dateInput) return 'Sabtu, 31 Desember 2016';
    const d = new Date(dateInput);
    const dayName = DAYS_ID[d.getUTCDay()];
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTHS_ID_FULL[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Format format ISO standard: "YYYY-MM-DD"
 */
export function formatISODate(dateInput) {
    const d = new Date(dateInput);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Menghitung tanggal baru berdasarkan hari tambahan dari tanggal acuan
 * @param {string|Date} baseDate - Tanggal acuan (default: 2016-12-31)
 * @param {number} daysOffset - Jumlah hari yang ditambahkan
 * @returns {{ date: Date, iso: string, formatted: string, fullFormatted: string }}
 */
export function calculateNewDate(baseDate = BASELINE_DATE, daysOffset = 0) {
    const start = new Date(baseDate);
    const resultDate = new Date(start.getTime() + daysOffset * 86400000);
    return {
        date: resultDate,
        iso: formatISODate(resultDate),
        formatted: formatIndonesianDate(resultDate),
        fullFormatted: formatIndonesianDayAndDate(resultDate),
    };
}
