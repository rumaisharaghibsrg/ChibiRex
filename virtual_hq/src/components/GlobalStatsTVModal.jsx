/**
 * GlobalStatsTVModal.jsx — Smart TV: Dual-State Responsive UI (1/8 Peek & 1/4 Inspect)
 *
 * Menerapkan spesifikasi transformatif:
 *  1. STATE PEEK (1/8 Layar Game):
 *     - Popup minimalis di sudut kanan atas kanvas game saat player mendekati TV (< 50px).
 *     - Player TIDAK dibekukan (tetap bebas berjalan).
 *     - Menampilkan Health Score toko yang diawasi dan rata-rata jaringan, plus petunjuk [E] Inspect.
 *  2. STATE INSPECT (1/4 Layar Game):
 *     - Membesar secara mulus (smooth CSS transition all 0.3s ease-in-out) saat [E] ditekan.
 *     - Menjadi panel sidebar kanan di dalam viewport game aktif.
 *     - Player dibekukan.
 *     - Menampilkan 4 kartu KPI, grafik Health terendah, tertinggi, dan semua toko, status SKU, dan status
 *       agent/guardrail.
 *     - Semua angka dari API Rexa (ringkasan toko, /jaringan/ringkasan, guardrail, worker, hitung fisik).
 *     - Data dibaca sekali per toko lalu disimpan; data baru hanya lewat tombol "Muat Ulang". Pemain tidak dibekukan:
 *       panel tertutup saat pemain pergi, menekan ✕, atau Esc.
 *     - Penutupan via tombol [X] atau tombol keyboard [ESC] mengembalikan kontrol gerak pemain.
 *  3. KONTEN RELATIF KANVAS GAME:
 *     - 100% position: absolute di dalam container viewport game aktif, tidak pernah meluber ke letterbox.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { useTimeSimulation } from '../context/TimeSimulationContext';
import { EventBus } from '../game/EventBus';
import { api } from '../lib/api';
import { pakaiKontrolSentuh } from '../utils/perangkat';
import { angka, rupiahRingkas, statusHealth } from '../lib/format';

const WARNA_STATUS = { AMAN: '#34d399', REORDER: '#fbbf24', OVERSTOCK: '#38bdf8', DEADSTOCK: '#f87171' };

const kartuGrafik = {
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid rgba(56, 189, 248, 0.18)',
};

function JudulGrafik({ judul, keterangan = 'klik = pindah toko' }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#e2e8f0' }}>{judul}</span>
            <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#38bdf8' }}>{keterangan}</span>
        </div>
    );
}

// Grafik batang Health Score beberapa toko (terendah atau tertinggi). Klik batang = pindah ke toko itu.
function GrafikHealth({ judul, toko, storeAktif, onPilih }) {
    const [sorot, setSorot] = useState(null);
    return (
        <div style={kartuGrafik}>
            <JudulGrafik judul={judul} />
            {toko.length === 0 ? (
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Statistik jaringan belum tersedia di API ini.</div>
            ) : (
                <div
                    style={{
                        height: '110px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: '6px',
                        paddingBottom: '20px',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                        position: 'relative',
                    }}
                >
                    {toko.map((t, index) => {
                        const isAktif = t.store === storeAktif;
                        return (
                            <div
                                key={t.store}
                                style={{
                                    flex: 1,
                                    height: '100%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    position: 'relative',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={() => setSorot(index)}
                                onMouseLeave={() => setSorot(null)}
                                onClick={() => onPilih(t.store)}
                                title={`Toko ${t.store} · ${t.kota} · Health ${t.health_score}`}
                            >
                                {sorot === index && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            bottom: `${Math.min(t.health_score + 14, 86)}%`,
                                            background: '#0284c7',
                                            border: '1px solid #38bdf8',
                                            borderRadius: '4px',
                                            padding: '2px 5px',
                                            fontSize: '9px',
                                            fontFamily: 'monospace',
                                            fontWeight: 'bold',
                                            color: '#ffffff',
                                            whiteSpace: 'nowrap',
                                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.5)',
                                            zIndex: 10,
                                        }}
                                    >
                                        {t.kota} · {t.health_score}
                                    </div>
                                )}
                                <div
                                    className="tv-interactive-bar"
                                    style={{
                                        width: '100%',
                                        maxWidth: '30px',
                                        height: `${t.health_score}%`,
                                        background: statusHealth(t.health_score).warna,
                                        borderRadius: '4px 4px 1px 1px',
                                        outline: isAktif ? '2px solid #f8fafc' : 'none',
                                        transition: 'all 0.2s ease',
                                    }}
                                />
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: '-18px',
                                        fontSize: '9px',
                                        fontFamily: 'monospace',
                                        color: isAktif ? '#f8fafc' : '#94a3b8',
                                        fontWeight: isAktif ? 'bold' : 'normal',
                                    }}
                                >
                                    #{t.store}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Health Score semua toko dalam satu grafik (urut dari terendah). Batang terlalu tipis untuk label, jadi toko yang
// disorot ditulis di baris bawah; garis tipis menandai batas zona merah (65).
function GrafikSemuaToko({ toko, storeAktif, onPilih }) {
    const [sorot, setSorot] = useState(null);
    const urut = [...toko].sort((a, b) => a.health_score - b.health_score || a.store - b.store);
    const dipilih = sorot === null ? null : urut[sorot];
    const pertama = urut[0];
    const terakhir = urut[urut.length - 1];
    return (
        <div style={kartuGrafik}>
            <JudulGrafik judul={`📊 HEALTH SEMUA TOKO (${urut.length})`} keterangan="terendah → tertinggi" />
            <div style={{ position: 'relative', height: '90px', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <div
                    style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '1px' }}
                    onMouseLeave={() => setSorot(null)}
                >
                    {urut.map((t, i) => (
                        <div
                            key={t.store}
                            onMouseEnter={() => setSorot(i)}
                            onClick={() => onPilih(t.store)}
                            title={`Toko ${t.store} · ${t.kota} · Health ${t.health_score}`}
                            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', cursor: 'pointer', minWidth: 0 }}
                        >
                            <div
                                style={{
                                    width: '100%',
                                    height: `${t.health_score}%`,
                                    background: statusHealth(t.health_score).warna,
                                    borderRadius: '2px 2px 0 0',
                                    opacity: sorot === null || sorot === i ? 1 : 0.55,
                                    outline: t.store === storeAktif ? '1px solid #f8fafc' : 'none',
                                }}
                            />
                        </div>
                    ))}
                </div>
                {/* Batas zona merah di atas batang (tidak menangkap klik); label di kiri, di atas batang merah yang pendek */}
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: '65%', borderTop: '1px solid rgba(248, 113, 113, 0.6)', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', left: '2px', bottom: 'calc(65% + 2px)', fontSize: '8px', fontFamily: 'monospace', color: '#f87171', pointerEvents: 'none' }}>
                    batas merah 65
                </span>
            </div>
            <div style={{ fontSize: '9px', fontFamily: 'monospace', color: dipilih ? '#f8fafc' : '#94a3b8', marginTop: '6px', minHeight: '13px' }}>
                {dipilih
                    ? `Toko ${dipilih.store} · ${dipilih.kota} · Health ${dipilih.health_score} (klik = pindah toko)`
                    : pertama && `Terendah Toko ${pertama.store} (${pertama.health_score}) · tertinggi Toko ${terakhir.store} (${terakhir.health_score})`}
            </div>
        </div>
    );
}

export function GlobalStatsTVModal({ mode = 'hidden', onInspect, onClose }) {
    const { currentStore, switchStore, mode: modeHq } = useStore();
    // Mode Semua Toko: TV menampilkan statistik seluruh jaringan (disimpan dengan kunci 'jaringan').
    const modeJaringan = modeHq === 'jaringan';
    const { formattedDate } = useTimeSimulation();
    const [cache, setCache] = useState({}); // toko -> {ringkasan, jaringan, guard, worker, fisik, tanggal}
    const [memuat, setMemuat] = useState(false);
    const [galat, setGalat] = useState(null);
    const dicobaRef = useRef(new Set());
    const terbuka = mode !== 'hidden';
    const sentuh = pakaiKontrolSentuh(); // petunjuk tombol keyboard tidak ditampilkan di HP/tablet
    const storeId = currentStore?.id || 74;
    const kunci = modeJaringan ? 'jaringan' : storeId;
    const data = cache[kunci] || null;

    const muat = useCallback(() => {
        setMemuat(true);
        if (modeJaringan) {
            Promise.all([api.jaringan(), api.statusGuardrail(), api.statusWorker().catch(() => null)])
                .then(([jaringan, guard, worker]) => {
                    setCache((c) => ({ ...c, jaringan: { ringkasan: null, jaringan, guard, worker, fisik: [], tanggal: formattedDate } }));
                    setGalat(null);
                })
                .catch((e) => setGalat(e.message))
                .finally(() => setMemuat(false));
            return;
        }
        Promise.all([
            api.ringkasan(storeId),
            api.jaringan().catch(() => null), // statistik jaringan opsional (API lama belum punya)
            api.statusGuardrail(storeId),
            api.statusWorker().catch(() => null),
            api.stokFisik(storeId).catch(() => []),
        ])
            .then(([ringkasan, jaringan, guard, worker, fisik]) => {
                setCache((c) => ({ ...c, [storeId]: { ringkasan, jaringan, guard, worker, fisik, tanggal: formattedDate } }));
                setGalat(null);
            })
            .catch((e) => setGalat(e.message))
            .finally(() => setMemuat(false));
    }, [storeId, formattedDate, modeJaringan]);

    // Dibaca sekali per toko (atau sekali untuk jaringan) saat TV pertama kali terlihat; sesudahnya lewat "Muat Ulang".
    useEffect(() => {
        if (terbuka && !dicobaRef.current.has(kunci)) {
            dicobaRef.current.add(kunci);
            muat();
        }
    }, [terbuka, kunci, muat]);
    const usang = data && data.tanggal !== formattedDate;

    const r = data?.ringkasan;
    const j = data?.jaringan;
    const skor = r ? statusHealth(r.health_score) : null;
    const peringkat = r && j ? 1 + j.toko.filter((t) => t.health_score > r.health_score).length : null;
    const tokoKritis = j ? j.toko.filter((t) => t.health_score < 65).length : null;
    const terendah = j ? [...j.toko].sort((a, b) => a.health_score - b.health_score || a.store - b.store).slice(0, 7) : [];
    const tertinggi = j ? [...j.toko].sort((a, b) => b.health_score - a.health_score || a.store - b.store).slice(0, 7) : [];
    const storeAktif = modeJaringan ? null : storeId; // di mode Semua Toko tidak ada toko yang ditandai
    const statusSku = r
        ? Object.keys(WARNA_STATUS).map((k) => ({ kode: k, jumlah: r.jumlah_status[k] ?? 0 }))
        : [];
    const totalSku = statusSku.reduce((t, x) => t + x.jumlah, 0) || 1;
    const persenTertahan = r?.nilai_stok_idr ? Math.round((100 * r.modal_tertahan_idr) / r.nilai_stok_idr) : 0;
    const siap = Boolean(modeJaringan ? j : r);
    const tokoSehat = j ? j.toko.filter((t) => t.health_score >= 80).length : 0;
    const persenTertahanJaringan = j?.nilai_stok_idr ? Math.round((100 * j.modal_tertahan_idr) / j.nilai_stok_idr) : 0;
    const worker = data?.worker;
    const statusAgent = !worker ? { teks: '-', warna: '#94a3b8' }
        : worker.mode === 'antrian'
            ? (worker.aktif ? { teks: 'WORKER AKTIF', warna: '#34d399' } : { teks: 'WORKER MATI', warna: '#f87171' })
            : worker.mode === 'lokal' ? { teks: 'LOKAL', warna: '#34d399' } : { teks: 'NONAKTIF', warna: '#f87171' };

    // Tampilan yang sama untuk kedua mode: angka toko yang diawasi, atau angka seluruh jaringan.
    const peekKiri = modeJaringan
        ? { label: 'Health jaringan', nilai: j ? `${angka(j.health_rata)}/100` : galat ? 'Offline' : '...', warna: j ? statusHealth(j.health_rata).warna : '#ffffff' }
        : { label: `Health Toko ${storeId}`, nilai: r ? `${r.health_score}/100` : galat ? 'Offline' : '...', warna: skor?.warna || '#ffffff' };
    const peekKanan = modeJaringan
        ? { label: 'Toko kritis', nilai: j ? `${tokoKritis} toko` : '-' }
        : { label: 'Rata-rata jaringan', nilai: j ? angka(j.health_rata) : '-' };
    const kartu = !siap ? [] : modeJaringan ? [
        { judul: `HEALTH ${j.jumlah_toko} TOKO`, warna: '#38bdf8', nilai: angka(j.health_rata), satuan: '/ 100', warnaNilai: statusHealth(j.health_rata).warna, sub: 'Rata-rata jaringan' },
        { judul: 'TOKO KRITIS', warna: '#a78bfa', nilai: angka(tokoKritis), satuan: 'toko', sub: `Health < 65 · ${tokoSehat} toko sehat` },
        { judul: 'PERLU REORDER', warna: '#fbbf24', nilai: angka(j.perlu_reorder), satuan: 'SKU', sub: `${angka(j.sku_risiko_tinggi)} risiko stok habis tinggi` },
        { judul: 'MODAL TERTAHAN', warna: '#f472b6', nilai: rupiahRingkas(j.modal_tertahan_idr), sub: `${persenTertahanJaringan}% nilai stok jaringan` },
    ] : [
        { judul: `HEALTH TOKO ${storeId}`, warna: '#38bdf8', nilai: r.health_score, satuan: '/ 100', warnaNilai: skor?.warna, sub: `${skor.label}${peringkat ? ` · #${peringkat} dari ${j.jumlah_toko}` : ''}` },
        { judul: `JARINGAN ${j ? j.jumlah_toko : 80} TOKO`, warna: '#a78bfa', nilai: j ? angka(j.health_rata) : '-', sub: j ? `${tokoKritis} toko kritis (< 65)` : 'Statistik jaringan belum tersedia' },
        { judul: 'PERLU REORDER', warna: '#fbbf24', nilai: angka(r.jumlah_status.REORDER ?? 0), satuan: 'SKU', sub: `${angka(r.sku_risiko_tinggi)} risiko stok habis tinggi` },
        { judul: 'MODAL TERTAHAN', warna: '#f472b6', nilai: rupiahRingkas(r.modal_tertahan_idr), sub: `${persenTertahan}% nilai stok` },
    ];
    const sebaran = !siap ? [] : modeJaringan ? [
        { kode: 'SEHAT (≥ 80)', jumlah: tokoSehat, warna: '#34d399' },
        { kode: 'PERHATIAN (65-79)', jumlah: j.toko.length - tokoSehat - tokoKritis, warna: '#fbbf24' },
        { kode: 'KRITIS (< 65)', jumlah: tokoKritis, warna: '#f87171' },
    ] : statusSku.map((x) => ({ ...x, warna: WARNA_STATUS[x.kode] }));
    const totalSebaran = sebaran.reduce((t, x) => t + x.jumlah, 0) || 1;
    const judulSebaran = !siap ? '' : modeJaringan ? `🏬 SEBARAN ${j.jumlah_toko} TOKO` : `📦 STATUS ${angka(r.sku_aktif)} SKU AKTIF`;
    const barisStatus = !siap ? [] : [
        { label: modeJaringan ? '🤖 Worker agent toko' : '🤖 Agent Rexa', ...statusAgent },
        modeJaringan
            ? { label: '📋 Draf PO menunggu (jaringan)', teks: `${angka(j.po_menunggu)} PO`, warna: j.po_menunggu ? '#fbbf24' : '#34d399' }
            : { label: '📦 Maya: hitung fisik', teks: data.fisik.length ? `${data.fisik.length} MENUNGGU AUDIT` : 'TIDAK ADA', warna: data.fisik.length ? '#fbbf24' : '#34d399' },
        {
            label: '🛡️ Rian: circuit breaker',
            teks: data.guard.circuit_breaker_terbuka ? 'TERBUKA' : 'TERTUTUP',
            warna: data.guard.circuit_breaker_terbuka ? '#f87171' : '#34d399',
        },
    ];

    // ── Tangani Tombol ESC dan Universal E Toggle untuk Interaksi (Directive v4.8) ─
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if (isInputTarget) return;

            if (e.key === 'Escape' && mode === 'inspect') {
                if (onClose) onClose();
            } else if ((e.key === 'e' || e.key === 'E') && mode === 'peek') {
                e.preventDefault();
                if (onInspect) onInspect();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, onInspect, onClose]);

    const isHidden  = mode === 'hidden';
    const isPeek    = mode === 'peek';
    const isInspect = mode === 'inspect';

    return (
        <div
            id="smart-tv-responsive-container"
            className={isInspect ? 'mode-inspect' : isPeek ? 'mode-peek' : 'mode-hidden'}
            style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                zIndex: isInspect ? 99999 : 40,
                pointerEvents: isHidden ? 'none' : 'auto',
                opacity: isHidden ? 0 : 1,
                transform: isHidden
                    ? 'translateX(30px) scale(0.95)'
                    : 'translateX(0) scale(1)',
                width: isInspect ? '380px' : isPeek ? '240px' : '0px',
                height: isInspect ? 'calc(100% - 28px)' : isPeek ? '116px' : '0px',
                maxHeight: isInspect ? '610px' : '120px',
                transition: 'width 0.32s cubic-bezier(0.16, 1, 0.3, 1), height 0.32s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: isInspect ? '16px' : '12px',
                overflow: 'hidden',
                background: isInspect
                    ? 'linear-gradient(160deg, rgba(15, 23, 42, 0.96) 0%, rgba(2, 6, 23, 0.98) 100%)'
                    : 'linear-gradient(135deg, rgba(15, 23, 42, 0.90) 0%, rgba(3, 7, 18, 0.94) 100%)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: isInspect
                    ? '1px solid rgba(56, 189, 248, 0.45)'
                    : '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: isInspect
                    ? '-12px 0 35px rgba(0, 0, 0, 0.7), 0 0 25px rgba(6, 182, 212, 0.25)'
                    : '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(6, 182, 212, 0.18)',
                color: '#f8fafc',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                userSelect: 'none',
            }}
        >
            <style>{`
                .tv-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .tv-scrollbar::-webkit-scrollbar-track {
                    background: rgba(15, 23, 42, 0.4);
                }
                .tv-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(56, 189, 248, 0.25);
                    border-radius: 4px;
                }
                .tv-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(56, 189, 248, 0.5);
                }
                .tv-interactive-bar:hover {
                    filter: brightness(1.3);
                }
            `}</style>

            {/* ══════════════════════════════════════════════════════════════════
                KONDISI 1: STATE PEEK (1/8 Layar Game — Non-Intrusif)
                ══════════════════════════════════════════════════════════════════ */}
            {isPeek && (
                <div
                    style={{
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '100%',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Top Row: Title & Live indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px' }}>📺</span>
                            <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '800', color: '#38bdf8', letterSpacing: '0.5px' }}>
                                SMART TV LIVE
                            </span>
                        </div>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '9px',
                                fontFamily: 'monospace',
                                color: '#34d399',
                                background: 'rgba(16, 185, 129, 0.15)',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                            }}
                        >
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 5px #34d399' }} />
                            1/8 PEEK
                        </span>
                    </div>

                    {/* Middle: Key Numbers */}
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0' }}>
                        <div>
                            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '-2px' }}>{peekKiri.label}</span>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: peekKiri.warna, letterSpacing: '-0.3px' }}>
                                {peekKiri.nilai}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '-2px' }}>{peekKanan.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa', fontFamily: 'monospace' }}>
                                {peekKanan.nilai}
                            </span>
                        </div>
                    </div>

                    {/* Bottom: Action Trigger Button */}
                    <button
                        onClick={onInspect}
                        style={{
                            width: '100%',
                            padding: '4px 8px',
                            background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.25) 0%, rgba(6, 182, 212, 0.35) 100%)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: '6px',
                            color: '#38bdf8',
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(90deg, rgba(2, 132, 199, 0.45) 0%, rgba(6, 182, 212, 0.55) 100%)';
                            e.currentTarget.style.borderColor = '#38bdf8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(90deg, rgba(2, 132, 199, 0.25) 0%, rgba(6, 182, 212, 0.35) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                        }}
                    >
                        {!sentuh && (
                        <kbd
                            style={{
                                background: '#0284c7',
                                color: '#ffffff',
                                borderRadius: '3px',
                                padding: '1px 5px',
                                fontSize: '9px',
                                fontWeight: '800',
                            }}
                        >
                            E
                        </kbd>
                        )}
                        <span>Buka Command Center</span>
                    </button>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                KONDISI 2: STATE INSPECT (1/4 Layar Game — Sidebar Panel Elegan)
                ══════════════════════════════════════════════════════════════════ */}
            {isInspect && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header Sidebar */}
                    <div
                        style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                            background: 'rgba(2, 6, 23, 0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)',
                                }}
                            >
                                📺
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.2px' }}>
                                    COMMAND CENTER
                                </h3>
                                <span style={{ fontSize: '9px', color: '#38bdf8', fontFamily: 'monospace' }}>
                                    {modeJaringan ? 'SEMUA TOKO' : `STORE #${storeId} (${currentStore?.city || 'PAENTMARWY'})`}{data ? ` • data ${data.tanggal}` : ''}
                                </span>
                            </div>
                        </div>

                        {/* Muat Ulang: ambil data terbaru dari API */}
                        <button
                            onClick={muat}
                            disabled={memuat}
                            style={{
                                marginLeft: 'auto',
                                marginRight: '6px',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                background: 'rgba(2, 132, 199, 0.2)',
                                color: '#7dd3fc',
                                fontSize: '10px',
                                fontWeight: '700',
                                fontFamily: 'monospace',
                                cursor: memuat ? 'not-allowed' : 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                            title="Ambil data terbaru dari API"
                        >
                            {memuat ? 'Memuat...' : '↻ Muat Ulang'}
                        </button>

                        {/* Tombol Tutup [X] */}
                        <button
                            onClick={onClose}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                border: '1px solid rgba(148, 163, 184, 0.25)',
                                background: 'rgba(30, 41, 59, 0.6)',
                                color: '#94a3b8',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ffffff';
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                                e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)';
                            }}
                            title="Tutup (ESC)"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body Scrollable Sidebar */}
                    <div
                        className="tv-scrollbar"
                        style={{
                            padding: '14px 16px',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            flex: 1,
                        }}
                    >
                        {!siap && (
                            <div style={{ fontSize: '11px', color: galat ? '#f87171' : '#94a3b8', lineHeight: 1.5 }}>
                                {galat ? `Data toko tidak bisa dibaca: ${galat}` : 'Memuat data toko...'}
                            </div>
                        )}
                        {siap && (usang || galat) && (
                            <div style={{ fontSize: '10px', color: '#fbbf24', lineHeight: 1.5, background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', padding: '6px 8px' }}>
                                {galat
                                    ? `Muat ulang terakhir gagal: ${galat}`
                                    : `Data ${data.tanggal}; tanggal simulasi sekarang ${formattedDate}. Tekan Muat Ulang.`}
                            </div>
                        )}

                        {siap && (
                        <>
                        {/* 4 Kartu KPI Grid 2x2 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {kartu.map((k) => (
                                <div
                                    key={k.judul}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: `1px solid ${k.warna}2e`,
                                    }}
                                >
                                    <span style={{ fontSize: '9px', fontFamily: 'monospace', color: k.warna, fontWeight: '700' }}>
                                        {k.judul}
                                    </span>
                                    <div style={{ fontSize: '15px', fontWeight: '800', color: k.warnaNilai || '#ffffff', margin: '3px 0 1px' }}>
                                        {k.nilai}{k.satuan && <span style={{ fontSize: '10px', color: '#94a3b8' }}> {k.satuan}</span>}
                                    </div>
                                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>{k.sub}</span>
                                </div>
                            ))}
                        </div>

                        {/* Grafik Health: terendah, tertinggi, dan semua toko (klik batang = pindah ke toko itu) */}
                        <GrafikHealth judul="📉 HEALTH TERENDAH DI JARINGAN" toko={terendah} storeAktif={storeAktif} onPilih={switchStore} />
                        <GrafikHealth judul="📈 HEALTH TERTINGGI DI JARINGAN" toko={tertinggi} storeAktif={storeAktif} onPilih={switchStore} />
                        {j && <GrafikSemuaToko toko={j.toko} storeAktif={storeAktif} onPilih={switchStore} />}

                        {/* Status SKU toko yang diawasi, atau sebaran toko per warna Health di mode Semua Toko */}
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: '12px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(56, 189, 248, 0.18)',
                            }}
                        >
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                                {judulSebaran}
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {sebaran.map((x) => {
                                    const persen = Math.round((100 * x.jumlah) / totalSebaran);
                                    return (
                                        <div key={x.kode}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '2px' }}>
                                                <span style={{ color: '#cbd5e1' }}>{x.kode}</span>
                                                <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{angka(x.jumlah)} · {persen}%</span>
                                            </div>
                                            <div style={{ height: '4px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ width: `${persen}%`, height: '100%', background: x.warna }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Status agent, audit/draf PO, dan guardrail */}
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: '10px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(56, 189, 248, 0.18)',
                                fontSize: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px',
                            }}
                        >
                            {barisStatus.map((b) => (
                                <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#cbd5e1' }}>{b.label}</span>
                                    <span style={{ color: b.warna, fontFamily: 'monospace', fontWeight: '700' }}>{b.teks}</span>
                                </div>
                            ))}
                        </div>
                        </>
                        )}
                    </div>

                    {/* Footer Sidebar */}
                    <div
                        style={{
                            padding: '10px 16px',
                            borderTop: '1px solid rgba(56, 189, 248, 0.15)',
                            background: 'rgba(2, 6, 23, 0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexShrink: 0,
                            gap: '8px',
                        }}
                    >
                        <button
                            onClick={() => {
                                if (onClose) onClose();
                                EventBus.emit('open-regional-dashboard');
                                window.dispatchEvent(new CustomEvent('open-regional-dashboard'));
                            }}
                            style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#34d399',
                                fontSize: '10px',
                                fontWeight: '700',
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)';
                                e.currentTarget.style.borderColor = '#34d399';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                            }}
                            title="Buka Regional Command Center untuk berpindah ke salah satu dari 80 cabang"
                        >
                            <span>🗺️ Ganti Cabang</span>
                        </button>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                fontSize: '10px',
                                fontWeight: '700',
                                fontFamily: 'monospace',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.25)';
                                e.currentTarget.style.borderColor = '#38bdf8';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                            }}
                        >
                            <span>Tutup Sidebar</span>
                            {!sentuh && (
                            <kbd
                                style={{
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    borderRadius: '3px',
                                    padding: '1px 4px',
                                    fontSize: '9px',
                                }}
                            >
                                ESC
                            </kbd>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
