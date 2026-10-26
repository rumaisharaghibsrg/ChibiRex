/**
 * logAktivitas.js — Satu daftar pesan untuk panel Log Aktivitas (pojok kiri atas Virtual HQ).
 *
 * Doni (alarm krisis, penyelesaian), Rexa (mulai, langkah, selesai/gagal), manajer (keputusan PO), dan sistem (tanggal
 * simulasi, ganti toko) menulis lewat catatLog(); panel mendengarkan event 'log-aktivitas'. 60 pesan terakhir
 * disimpan di localStorage browser ini supaya tidak hilang saat halaman dimuat ulang.
 */

import { EventBus } from '../game/EventBus';

const KUNCI = 'rexa.logAktivitas.v1';
const MAKS = 60;

function baca() {
    try {
        const isi = JSON.parse(localStorage.getItem(KUNCI));
        return Array.isArray(isi) ? isi.slice(-MAKS) : [];
    } catch {
        return [];
    }
}

let daftar = baca();

function simpan() {
    try {
        localStorage.setItem(KUNCI, JSON.stringify(daftar));
    } catch {
        // localStorage tidak tersedia (mode privat): log tetap jalan selama halaman terbuka
    }
}

export const isiLog = () => daftar;

/**
 * dari: 'doni' | 'rexa' | 'manajer' | 'sistem'; tingkat: 'info' | 'urgent' | 'sukses' | 'gagal'.
 * `unik`: lewati kalau pesan yang sama sudah ada di 20 pesan terakhir (alarm Doni yang diperiksa ulang tiap menit atau
 * setelah halaman dimuat ulang).
 */
export function catatLog(dari, teks, tingkat = 'info', { unik = false } = {}) {
    if (unik && daftar.slice(-20).some((p) => p.dari === dari && p.teks === teks)) return;
    const pesan = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pukul: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        dari,
        teks,
        tingkat,
    };
    daftar = [...daftar, pesan].slice(-MAKS);
    simpan();
    EventBus.emit('log-aktivitas', daftar);
}

export function bersihkanLog() {
    daftar = [];
    simpan();
    EventBus.emit('log-aktivitas', daftar);
}

/** Satu langkah agent Rexa (pemanggilan tool) dalam kalimat singkat. */
export function teksLangkahAgent(langkah) {
    const o = (langkah.output && typeof langkah.output === 'object') ? langkah.output : {};
    const i = langkah.input || {};
    const nama = o.deskripsi || i.inventory_id || '';
    switch (langkah.tool) {
        case 'list_prioritas': return `Membaca daftar SKU prioritas Toko ${i.store}`;
        case 'get_sku_metrics': return `Memeriksa detail ${nama}`;
        case 'check_substitution': return `Cek peran komplementer ${o.jenis || nama}: ${o.status || '-'}`;
        case 'hold_reorder': return o.ditolak ? `Hold ${nama} ditolak guardrail` : `Menahan reorder ${nama}`;
        case 'draft_purchase_order':
            return o.status === 'DRAFT' ? `Menyusun draf PO ${nama}`
                : `PO ${nama} ditahan guardrail${o.pelanggaran?.length ? ` (${o.pelanggaran.join(', ')})` : ''}`;
        case 'suggest_reallocation': return 'Menyarankan pengalihan modal';
        default: return `Memanggil ${langkah.tool}`;
    }
}

/**
 * Isi pertama ringkasan agent tanpa format markdown, untuk satu baris log. Kalimat pengantar yang diakhiri titik dua
 * ("Berikut ringkasannya untuk dashboard:") dilewati karena bukan isinya.
 */
export function ringkasJawaban(teks, maks = 140) {
    const isi = (teks || '').replace(/\*\*/g, '').split('\n')
        .map((b) => b.replace(/^[-#\s]+/, '').split(/(?<=\.)\s+/).filter((k) => !k.trim().endsWith(':')).join(' ').trim())
        .find((b) => b.length > 0) || '';
    return isi.length > maks ? `${isi.slice(0, maks - 1)}…` : isi;
}
