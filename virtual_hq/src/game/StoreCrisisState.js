/**
 * StoreCrisisState.js — Krisis toko untuk Crisis Command Hub Doni (Koordinator)
 *
 * Doni adalah pengawas proaktif (watchdog): App memanggil pantauKrisis() saat game dibuka, saat toko/mode/tanggal
 * berganti, setiap data berubah (agent selesai, PO diputuskan, breaker direset), dan tiap menit. Doni tidak mengarang
 * krisis: deteksiKrisis() membaca API Rexa untuk toko yang diawasi dan hanya melaporkan kondisi yang benar-benar ada,
 * diurutkan dari yang paling parah:
 *  - Rian: circuit breaker terbuka (semua PO baru ditahan).
 *  - Pak Budi: Health Score di bawah 65 (zona merah dashboard).
 *  - Maya: SKU yang penjualannya naik dengan risiko stok habis TINGGI. Dibaca dari endpoint yang sama dengan laporan
 *    Maya (/stores/{store}/maya/status), supaya angka Doni dan Maya tidak pernah berbeda sumber.
 *  - Citra: lebih dari 40% nilai stok tertahan di SKU overstock/deadstock (komponen stabilitas kas < 60).
 *
 * Tugas Doni adalah menyelesaikan krisis, bukan hanya melaporkannya. Tombol "Selesaikan" (satu klik manajer, yang
 * sekaligus menjadi persetujuannya) menjalankan selesaikanKrisis(): Rexa menyusun PO untuk semua SKU kritis (atau
 * meninjau toko / menahan reorder SKU yang turun), lalu PO yang lolos guardrail langsung dikirim ke SAP sehingga
 * barangnya dalam pengiriman dan krisisnya hilang dari data. Guardrail tetap berlaku: PO yang ditahan tidak disetujui.
 *
 * Setiap krisis berstatus BARU (alarm: tombol Doni Hub merah, Doni mendatangi pemain, klaxon) atau DITANGANI (sedang
 * diselesaikan atau sudah ditangani untuk tanggal data ini, agent sedang bekerja untuk toko itu, atau semua SKU kritis
 * sudah punya draf PO). Hasil pemeriksaan disimpan per toko (hasilTerakhir) dan menjadi satu sumber untuk tombol
 * header, sprite Doni, dan panel Crisis Hub; setiap perubahan diumumkan lewat event 'doni-status'.
 */

import { EventBus } from './EventBus';
import { api, beritahuDataBerubah } from '../lib/api';
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

const hasilPerToko = new Map(); // toko (atau 'jaringan') -> {krisis, ringkas, tanggal, perTanggal}
// Krisis yang sudah ditangani untuk tanggal data tertentu: `${kunci}|${perTanggal}|${crisisId}` -> {oleh, pukul}.
// Krisis yang sama tidak membunyikan alarm lagi sampai tanggal simulasi berganti.
const ditangani = new Map();
const sedangMemeriksa = new Map(); // kunci -> Promise pemeriksaan yang sedang berjalan
// Toko (atau 'jaringan') yang sedang diawasi, diberikan App lewat pantauKrisis(kunci). Tidak dibaca dari
// window.CURRENT_STORE karena itu diisi efek StoreProvider, yang berjalan setelah efek App.
let kunciDiawasi = null;

// Penyelesaian krisis lewat tombol Selesaikan (kunci sama dengan ditangani) -> {berjalan, tahap, pesan, disetujui,
// ditahan, gagal, mulai, selesai}. tahap: AGENT (Rexa bekerja), SAP (PO dikirim), SELESAI, atau GAGAL.
const penyelesaian = new Map();
const terakhirSelesai = new Map(); // kunci toko -> {judul, pesan, pukul}: ditampilkan setelah krisisnya hilang

const kunciDitangani = (kunci, perTanggal, crisisId) => `${kunci}|${perTanggal}|${crisisId}`;
const kunciAktif = () => kunciDiawasi
    ?? (window.CURRENT_MODE === 'jaringan' ? 'jaringan' : window.CURRENT_STORE?.id || 74);
const pukulSekarang = () => new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const jeda = (ms) => new Promise((r) => setTimeout(r, ms));

/** Hasil pemeriksaan terakhir untuk toko ini (atau 'jaringan'), atau null kalau belum pernah diperiksa. */
export const hasilTerakhir = (kunci) => hasilPerToko.get(kunci) || null;

/** Penyelesaian terakhir yang berhasil di toko ini (untuk panel setelah krisisnya hilang), atau null. */
export const penyelesaianTerakhir = (kunci) => terakhirSelesai.get(kunci) || null;

/**
 * Status krisis per tanggal data: BARU, kecuali sedang/sudah diselesaikan dari panel Doni, agent sedang bekerja untuk
 * toko ini (dari mana pun dijalankan), atau semua SKU-nya tinggal menunggu persetujuan manajer.
 */
function beriStatus(kunci, hasil) {
    for (const k of hasil.krisis) {
        const kunciK = kunciDitangani(kunci, hasil.perTanggal, k.crisisId);
        const catatan = ditangani.get(kunciK);
        k.penanganan = catatan || null;
        k.penyelesaian = penyelesaian.get(kunciK) || null;
        k.agentBekerja = Boolean(hasil.agentBekerja) && Boolean(k.action?.agent);
        k.status = catatan || k.penyelesaian?.berjalan || k.agentBekerja || k.menungguApproval ? 'DITANGANI' : 'BARU';
    }
    // Yang butuh tindakan tampil lebih dulu; urutan keparahan dipertahankan di dalam kelompoknya.
    hasil.krisis.sort((a, b) => (a.status === 'BARU' ? 0 : 1) - (b.status === 'BARU' ? 0 : 1));
    return hasil;
}

const statusRingkas = (hasil) => (hasil.krisis.some((k) => k.status === 'BARU') ? 'KRISIS'
    : hasil.krisis.length ? 'DITANGANI' : 'NORMAL');

/** SKU kritis dari laporan Maya; cadangan ke list_prioritas kalau API lama belum punya /maya/status. */
async function skuKritisMaya(s) {
    try {
        return (await api.mayaStatus(s)).sku_kritis || [];
    } catch {
        const p = await api.prioritas(s, { limit_naik: 10, limit_turun: 0 });
        return p.naik.filter((x) => x.level_risiko === 'TINGGI').sort((a, b) => (b.skor_risiko ?? 0) - (a.skor_risiko ?? 0));
    }
}

/**
 * Memeriksa data toko. Mengembalikan {krisis: [...], ringkas, tanggal, perTanggal}; krisis kosong berarti tidak ada
 * kondisi darurat. Melempar ApiError kalau API tidak terjangkau.
 */
export async function deteksiKrisis(store) {
    const s = store?.id || 74;
    const [r, g, kritis, draf, agentAktif] = await Promise.all([
        api.ringkasan(s),
        api.statusGuardrail(s),
        skuKritisMaya(s),
        api.daftarPo({ store: s, status: 'DRAFT' }).catch(() => []),
        api.agentAktif().catch(() => null),
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
            action: { jenis: 'reset-breaker', label: '🛠️ Selesaikan: reset circuit breaker (keputusan manajer)' },
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
                jenis: 'selesaikan',
                agent: true,
                setujui: true,
                label: '🛠️ Selesaikan: Rexa menangani toko ini, PO langsung ke SAP',
                store_id: s,
                tugas: `Krisis dari Doni: Health Score Toko ${s} ${r.health_score}/100, di bawah batas zona merah ` +
                    `${AMBANG_HEALTH}. Tinjau toko ${s} sesuai prosedur dan tangani penyebab terbesarnya.`,
            },
        });
    }

    if (kritis.length) {
        // SKU yang sudah punya draf PO tinggal menunggu persetujuan manajer; agent hanya perlu menangani sisanya.
        const adaDraf = new Set(draf.map((po) => po.inventory_id));
        const daftar = kritis.map((x) => ({ ...x, adaDraf: adaDraf.has(x.inventory_id) }));
        const tanpaDraf = daftar.filter((x) => !x.adaDraf);
        const jumlahDraf = daftar.length - tanpaDraf.length;
        const x = tanpaDraf[0] || daftar[0];
        krisis.push({
            crisisId: 'CRISIS_STOCKOUT_FAST_MOVING',
            sourceNPC: 'maya',
            sourceName: 'Maya (Auditor Stok & Gudang)',
            sourceLocation: 'Meja Hot-Desk & Ruang Arsip',
            title: `STOK KRITIS: ${(x.deskripsi || x.inventory_id).toUpperCase()}`,
            headline: `${daftar.length} SKU yang penjualannya naik berisiko tinggi kehabisan stok` +
                (jumlahDraf ? `; ${jumlahDraf} sudah punya draf PO menunggu persetujuan` : ''),
            description: `${x.deskripsi}: stok ${angka(x.stok_akhir)} unit di bawah reorder point ${angka(x.reorder_point)}, ` +
                `skor risiko ${x.skor_risiko}. Saran PO ${angka(x.saran_qty_po)} unit (${rupiah(x.nilai_saran_po_idr)}); ` +
                'agent menyusun drafnya, manajer yang menyetujui.',
            metrics: { label: 'Stok tersisa', currentValue: `${angka(x.stok_akhir)} unit`, thresholdValue: `Reorder point ${angka(x.reorder_point)} unit`, badgeColor: '#f97316' },
            store_id: s,
            sku_ids: daftar.map((item) => item.inventory_id),
            sku_list: daftar,
            jumlahDraf,
            menungguApproval: tanpaDraf.length === 0, // semua sudah ada drafnya: tinggal keputusan manajer
            // Selesaikan = Rexa memesan SKU yang belum punya draf, lalu semua PO SKU kritis yang lolos guardrail dikirim
            // ke SAP. Kalau semuanya sudah punya draf, Rexa tidak perlu dijalankan.
            action: {
                jenis: 'selesaikan',
                agent: tanpaDraf.length > 0,
                setujui: true,
                label: tanpaDraf.length
                    ? `🛠️ Selesaikan krisis stok (${daftar.length} SKU): Rexa memesan, PO langsung ke SAP`
                    : `🛠️ Selesaikan: kirim ${jumlahDraf} PO ke SAP`,
                store_id: s,
                tugas: `Krisis stok dari Doni (Toko ${s}): ${tanpaDraf.length} SKU yang penjualannya naik berisiko tinggi ` +
                    'kehabisan stok dan belum punya draf PO: ' +
                    tanpaDraf.map((item) => `${item.inventory_id} (${item.deskripsi})`).join(', ') +
                    `. Panggil list_prioritas untuk toko ${s} dengan limit_naik=10, lalu panggil draft_purchase_order ` +
                    'untuk setiap SKU di daftar ini saja. Lewati daftar turun dan SKU lain.',
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
            // Selesaikan = hentikan modal yang terus masuk ke stok yang tidak laku: Rexa menahan reorder SKU yang
            // penjualannya turun (dan tidak komplementer), lalu menyarankan pengalihan modalnya.
            action: {
                jenis: 'selesaikan',
                agent: true,
                setujui: false,
                label: '🛠️ Selesaikan: Rexa menahan reorder SKU yang turun dan mengalihkan modal',
                store_id: s,
                tugas: `Krisis modal dari Doni (Toko ${s}): ${persenTertahan}% nilai stok tertahan di SKU overstock dan ` +
                    `deadstock. Panggil list_prioritas untuk toko ${s}, tahan reorder SKU di daftar turun yang memenuhi ` +
                    'syarat (check_substitution dulu), lalu panggil suggest_reallocation. Jangan menyusun draf PO.',
            },
        });
    }

    const ringkas = `Health Score ${r.health_score}/100, circuit breaker ${g.circuit_breaker_terbuka ? 'terbuka' : 'tertutup'}, ` +
        `${angka(r.jumlah_status.REORDER ?? 0)} SKU perlu reorder, modal tertahan ${persenTertahan}% nilai stok.`;
    const hasil = beriStatus(s, {
        krisis: krisis.map((k) => ({ ...k, isCrisis: true, severity: 'CRITICAL', store: s, perTanggal: r.per_tanggal })),
        ringkas,
        tanggal: formatIndonesianDate(r.per_tanggal),
        perTanggal: r.per_tanggal,
        agentBekerja: Number(agentAktif?.store) === Number(s),
    });
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
    const hasil = beriStatus('jaringan', {
        krisis: krisis.map((k) => ({ ...k, isCrisis: true, severity: 'CRITICAL', store: 'jaringan', perTanggal: j.per_tanggal })),
        ringkas: `Health rata-rata ${angka(j.health_rata)}, ${merah.length} toko merah, circuit breaker ` +
            `${g.circuit_breaker_terbuka ? 'terbuka' : 'tertutup'}, ${angka(j.po_menunggu)} draf PO menunggu persetujuan.`,
        tanggal: formatIndonesianDate(j.per_tanggal),
        perTanggal: j.per_tanggal,
    });
    hasilPerToko.set('jaringan', hasil);
    return hasil;
}

// Inisialisasi Default State
export const defaultCrisisState = {
    isCrisis: false,
    statusDoni: 'NORMAL',
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
 * Satu-satunya pintu yang mengubah window.StoreCrisisState. Mengumumkan 'doni-status' setiap kali, dan
 * 'store-crisis-triggered' (klaxon) hanya kalau `bunyi`; Doni mendatangi pemain selama isCrisis.
 */
function terbitkan(state, { bunyi = false } = {}) {
    const lama = window.StoreCrisisState || defaultCrisisState;
    window.StoreCrisisState = { ...state, timestamp: Date.now() };
    const baru = window.StoreCrisisState;
    // Hanya lewat EventBus: MainScene mendengarkan EventBus dan window, jadi mengirim keduanya membunyikan klaxon dua kali.
    if (baru.isCrisis && bunyi) {
        EventBus.emit('store-crisis-triggered', baru);
    } else if (!baru.isCrisis && lama.isCrisis) {
        EventBus.emit('store-crisis-resolved', baru);
    }
    EventBus.emit('doni-status', baru);
    return baru;
}

// Krisis yang sudah diumumkan dengan klaxon (`${kunci}|${perTanggal}|${crisisId}`): pemantauan tiap menit dan
// pergantian krisis utama (misalnya setelah krisis Maya ditugaskan) tidak membunyikan alarm yang sama lagi.
const diumumkan = new Set();

/** Terapkan hasil pemeriksaan ke status global (header, sprite Doni, panel), hanya untuk toko yang sedang diawasi. */
function terapkan(kunci, hasil) {
    if (kunci !== kunciAktif()) return window.StoreCrisisState;
    const status = statusRingkas(hasil);
    const utama = hasil.krisis[0];
    const alarm = hasil.krisis.filter((k) => k.status === 'BARU').map((k) => kunciDitangani(kunci, hasil.perTanggal, k.crisisId));
    const bunyi = alarm.some((a) => !diumumkan.has(a));
    alarm.forEach((a) => diumumkan.add(a));
    return terbitkan(utama
        ? { ...utama, isCrisis: status === 'KRISIS', statusDoni: status, kunci }
        : { ...defaultCrisisState, statusDoni: 'NORMAL', kunci }, { bunyi });
}

/**
 * Pemeriksaan Doni untuk toko (atau 'jaringan') yang diawasi, lalu terapkan ke status global. Tanpa argumen: toko yang
 * terakhir diawasi. Pemeriksaan yang sama tidak dijalankan dua kali bersamaan. Mengembalikan hasilnya; melempar
 * ApiError kalau gagal.
 */
export function pantauKrisis(kunci = kunciAktif()) {
    if (kunci !== kunciDiawasi) {
        // Ganti toko: status toko lama tidak boleh tertinggal di header selama toko baru diperiksa.
        kunciDiawasi = kunci;
        const tersimpan = hasilPerToko.get(kunci);
        if (tersimpan) terapkan(kunci, tersimpan);
        else terbitkan({ ...defaultCrisisState, kunci });
    }
    if (!sedangMemeriksa.has(kunci)) {
        const periksa = (kunci === 'jaringan' ? deteksiKrisisJaringan() : deteksiKrisis({ id: kunci }))
            .then((hasil) => {
                // Cheat U+R mematikan alarm otomatis: hasil tetap tersimpan untuk panel, status global tidak diubah.
                if (window.DONI_ALARM_OTOMATIS !== false) terapkan(kunci, hasil);
                return hasil;
            })
            .finally(() => sedangMemeriksa.delete(kunci));
        sedangMemeriksa.set(kunci, periksa);
    }
    return sedangMemeriksa.get(kunci);
}

/**
 * Pending resolution: manajer menugaskan agent (oleh 'agent') atau meninjau laporan staf (oleh 'manajer') untuk krisis
 * ini. Krisis yang sama tidak membunyikan alarm lagi sampai tanggal simulasi berganti.
 */
export function tandaiDitangani(krisis, oleh) {
    const kunci = krisis.kunci ?? krisis.store ?? kunciAktif();
    const hasil = hasilPerToko.get(kunci);
    if (!hasil) return;
    const pukul = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    ditangani.set(kunciDitangani(kunci, hasil.perTanggal, krisis.crisisId), { oleh, pukul });
    beriStatus(kunci, hasil);
    terapkan(kunci, hasil);
}

/**
 * Minta App menjalankan Agent Rexa (bubble Rexa menampilkan langkahnya), lalu tunggu run untuk toko ini selesai.
 * Mengembalikan run akhirnya (GET /agent-runs/{id}).
 */
async function jalankanAgentDanTunggu(store, tugas) {
    EventBus.emit('jalankan-agent', { store: String(store), tugas });
    const mulai = Date.now();
    let runId = null;
    while (Date.now() - mulai < 300_000) {
        await jeda(2500);
        const aktif = await api.agentAktif().catch(() => null);
        if (aktif && Number(aktif.store) === Number(store)) {
            runId = aktif.run_id;
        } else if (runId) {
            return api.statusAgent(runId);
        } else if (Date.now() - mulai > 90_000) {
            throw new Error('Agent Rexa tidak mulai bekerja dalam 90 detik (cek worker/AgentCore).');
        }
    }
    throw new Error('Agent Rexa belum selesai setelah 5 menit.');
}

/**
 * Tombol Selesaikan di panel Doni (klik manajer = persetujuannya). Rexa menyusun PO untuk SKU kritis (atau meninjau
 * toko / menahan reorder), lalu PO yang lolos guardrail dikirim ke SAP. Kemajuannya tampil di panel lewat
 * krisis.penyelesaian; setelah selesai, Doni memeriksa ulang data sehingga krisis yang sudah pulih hilang.
 */
export async function selesaikanKrisis(krisis) {
    const kunci = krisis.store;
    const s = krisis.action?.store_id ?? krisis.store;
    const aksi = krisis.action || {};
    const kunciK = kunciDitangani(kunci, krisis.perTanggal, krisis.crisisId);
    if (penyelesaian.get(kunciK)?.berjalan) return;
    const catat = (data) => {
        penyelesaian.set(kunciK, { ...(penyelesaian.get(kunciK) || {}), ...data });
        const hasil = hasilPerToko.get(kunci);
        if (hasil) {
            beriStatus(kunci, hasil);
            terapkan(kunci, hasil);
        }
    };

    ditangani.set(kunciK, { oleh: 'doni', pukul: pukulSekarang() });
    catat({
        berjalan: true, tahap: aksi.agent ? 'AGENT' : 'SAP', mulai: pukulSekarang(), disetujui: [], ditahan: [], gagal: [],
        pesan: aksi.agent ? 'Rexa sedang mengerjakan krisis ini; langkahnya tampil di bubble Rexa.' : 'Mengirim PO ke SAP...',
    });
    try {
        let langkah = [];
        if (aksi.agent) {
            const run = await jalankanAgentDanTunggu(s, aksi.tugas);
            if (run.status !== 'SELESAI') throw new Error(run.pesan || 'Agent Rexa gagal menyelesaikan tugasnya.');
            langkah = run.langkah || [];
        }
        const poRun = langkah.filter((l) => l.tool === 'draft_purchase_order' && l.output?.po_id).map((l) => l.output);
        const holdRun = langkah.filter((l) => l.tool === 'hold_reorder' && l.output?.hold_id).map((l) => l.output);
        const ditahan = poRun.filter((p) => p.status !== 'DRAFT')
            .map((p) => `${p.deskripsi} (${(p.pelanggaran || []).join(', ') || p.status})`);
        const disetujui = [];
        const gagal = [];
        if (aksi.setujui) {
            catat({ tahap: 'SAP', pesan: 'Mengirim PO yang lolos guardrail ke SAP...' });
            const sasaran = new Set([...poRun.map((p) => p.po_id)]);
            const skuKrisis = new Set(krisis.sku_ids || []);
            const draf = await api.daftarPo({ store: s, status: 'DRAFT' });
            for (const po of draf.filter((p) => sasaran.has(p.po_id) || skuKrisis.has(p.inventory_id))) {
                try {
                    const r = await api.setujuiPo(po.po_id, `Selesaikan krisis lewat Doni: ${krisis.title}`);
                    disetujui.push({ deskripsi: r.deskripsi || po.deskripsi, sap: r.sap_po_number });
                } catch (e) {
                    gagal.push(`${po.deskripsi}: ${e.message}`);
                }
            }
        }
        const modal = holdRun.reduce((t, h) => t + (h.modal_diselamatkan_idr || 0), 0);
        const bagian = [];
        if (disetujui.length) bagian.push(`${disetujui.length} PO terkirim ke SAP, barangnya dalam pengiriman`);
        if (holdRun.length) bagian.push(`reorder ${holdRun.length} SKU yang turun ditahan, modal diselamatkan ${rupiahRingkas(modal)}`);
        if (ditahan.length) bagian.push(`${ditahan.length} PO ditahan guardrail`);
        if (gagal.length) bagian.push(`${gagal.length} PO gagal dikirim`);
        const pesan = bagian.length ? `${bagian.join('; ')}.` : 'Rexa tidak menemukan tindakan yang bisa diambil untuk krisis ini.';
        catat({ berjalan: false, tahap: disetujui.length || holdRun.length ? 'SELESAI' : 'GAGAL', pesan, disetujui, ditahan, gagal, selesai: pukulSekarang() });
        if (disetujui.length || holdRun.length) terakhirSelesai.set(kunci, { judul: krisis.title, pesan, pukul: pukulSekarang(), disetujui });
    } catch (e) {
        catat({ berjalan: false, tahap: 'GAGAL', pesan: e.message });
    } finally {
        beritahuDataBerubah(); // Doni dan panel lain memeriksa ulang: krisis yang sudah pulih hilang dari daftar
    }
}

/** Status Doni untuk tampilan: KRISIS (alarm), DITANGANI (pending resolution), atau NORMAL. */
export const statusDoni = () => window.StoreCrisisState?.statusDoni || 'NORMAL';

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
    if (window.DONI_ALARM_OTOMATIS === undefined) window.DONI_ALARM_OTOMATIS = true;

    /**
     * Cheat U+R+1..4: periksa data lalu bunyikan alarm untuk krisis NPC tertentu (atau krisis teratas), walaupun sudah
     * ditangani. Mengembalikan krisis yang diaktifkan, atau null kalau datanya tidak menunjukkan krisis itu.
     */
    window.triggerStoreCrisis = async (kunciCheat) => {
        const npc = KUNCI_KE_NPC[kunciCheat];
        const kunci = kunciAktif();
        const { krisis } = kunci === 'jaringan' ? await deteksiKrisisJaringan() : await deteksiKrisis({ id: kunci });
        const pilihan = npc ? krisis.find((k) => k.sourceNPC === npc) : krisis[0];
        if (!pilihan) return null;
        return terbitkan({ ...pilihan, isCrisis: true, statusDoni: 'KRISIS', kunci }, { bunyi: true });
    };

    window.resolveStoreCrisis = () => terbitkan({ ...defaultCrisisState, kunci: kunciAktif() });

    window.playEmergencyKlaxonSFX = playEmergencyKlaxonSFX;
}
