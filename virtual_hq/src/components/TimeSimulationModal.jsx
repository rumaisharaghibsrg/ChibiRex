/**
 * TimeSimulationModal.jsx — Temporal Simulation Engine Modal
 *
 * Menggeser jam simulasi API Rexa (+1/+7 hari, -1/-7 hari, kembali ke 31 Des 2016), sama dengan kontrol tanggal di
 * dashboard: stok, PO dalam pengiriman, dan Health Score ikut berubah. Kartu bawah menampilkan kondisi toko yang
 * diawasi pada tanggal simulasi sekarang (GET /stores/{store}/ringkasan).
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useTimeSimulation } from '../context/TimeSimulationContext';
import { useStore } from '../context/StoreContext';
import { EventBus } from '../game/EventBus';
import { calculateNewDate } from '../utils/TimeEngine';
import { api, DATA_BERUBAH } from '../lib/api';
import { angka, rupiahRingkas, statusHealth } from '../lib/format';
import { pakaiKontrolSentuh } from '../utils/perangkat';

export function TimeSimulationModal({ isOpen, onClose }) {
    const {
        currentSimulatedDate,
        daysOffset,
        hariMaks,
        isWarping,
        fullFormattedDate,
        triggerTimeWarp,
        resetTimeToBaseline,
    } = useTimeSimulation();

    const { currentStore, mode } = useStore();
    const modeJaringan = mode === 'jaringan';

    // Kalkulasi target tanggal untuk pratinjau tombol
    const next1Day = calculateNewDate(currentSimulatedDate, 1);
    const next7Days = calculateNewDate(currentSimulatedDate, 7);

    const [galat, setGalat] = useState(null);
    const [kondisi, setKondisi] = useState(null);
    const storeId = currentStore?.id || 74;

    // Kondisi toko yang diawasi pada tanggal simulasi sekarang; dimuat ulang setiap data berubah.
    useEffect(() => {
        if (!isOpen) return undefined;
        let aktif = true;
        // Mode Semua Toko: angka jaringan (health_rata, total perlu reorder, total modal diselamatkan).
        const muat = () => (modeJaringan
            ? api.jaringan().then((j) => ({
                health_score: j.health_rata,
                jumlah_status: { REORDER: j.perlu_reorder },
                modal_diselamatkan_idr: j.modal_diselamatkan_idr,
            }))
            : api.ringkasan(storeId))
            .then((r) => aktif && setKondisi(r))
            .catch(() => aktif && setKondisi(null));
        muat();
        EventBus.on(DATA_BERUBAH, muat);
        return () => {
            aktif = false;
            EventBus.removeListener(DATA_BERUBAH, muat);
        };
    }, [isOpen, storeId, modeJaringan]);

    // Handler tutup modal & unfreeze player
    const handleClose = useCallback(() => {
        if (isWarping) return; // Kunci modal jika animasi warp sedang berputar
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
        if (onClose) onClose();
    }, [isWarping, onClose]);

    // Listener tombol ESC & Universal E Toggle (Directive v4.8)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'e') && isOpen && !isWarping && !isInputTarget) {
                e.preventDefault();
                handleClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isWarping, handleClose]);

    // Eksekusi lompatan waktu lewat API; modal ditutup setelah API menerima supaya animasi warp terlihat.
    const handleJumpTime = async (days) => {
        if (isWarping) return;
        setGalat(null);
        const pesan = await triggerTimeWarp(days);
        if (pesan) setGalat(pesan);
        else if (onClose) onClose();
    };

    // Kembali ke 31 Des 2016: tanggal dan stok kembali ke data awal; PO, hold, dan riwayat agent tetap tersimpan.
    const handleReset = async () => {
        if (isWarping || daysOffset === 0) return;
        setGalat(null);
        const pesan = await resetTimeToBaseline();
        if (pesan) setGalat(pesan);
        else if (onClose) onClose();
    };

    const tombolMundur = (hari) => ({
        padding: '8px 12px',
        borderRadius: '10px',
        backgroundColor: 'rgba(30, 41, 59, 0.55)',
        border: '1px solid rgba(148, 163, 184, 0.3)',
        color: daysOffset < 1 ? '#64748b' : '#e2e8f0',
        cursor: daysOffset < 1 || isWarping ? 'not-allowed' : 'pointer',
        fontSize: '11px',
        fontWeight: '700',
        fontFamily: 'monospace',
        flex: 1,
        opacity: hari > daysOffset && daysOffset > 0 ? 0.8 : 1,
    });

    if (!isOpen) return null;

    return (
        <div
            className="time-modal-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(5, 8, 18, 0.85)',
                backdropFilter: 'blur(14px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px',
                animation: 'fadeIn 0.2s ease-out',
                fontFamily: 'monospace',
                color: '#f8fafc',
            }}
            onClick={handleClose}
        >
            <div
                className="time-modal-card"
                style={{
                    width: '100%',
                    maxWidth: '660px',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                {/* ── Top Header Bar ───────────────────────────────────────────── */}
                <div
                    style={{
                        padding: '16px 24px',
                        background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '10px',
                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.25) 100%)',
                                border: '1px solid rgba(245, 158, 11, 0.6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '22px',
                                boxShadow: '0 0 16px rgba(245, 158, 11, 0.3)',
                            }}
                        >
                            ⏳
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                    style={{
                                        fontSize: '15px',
                                        fontWeight: '900',
                                        letterSpacing: '0.06em',
                                        background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 50%, #38bdf8 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    TEMPORAL SIMULATION ENGINE
                                </span>
                                <span
                                    style={{
                                        fontSize: '10px',
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        backgroundColor: daysOffset > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                                        color: daysOffset > 0 ? '#fbbf24' : '#38bdf8',
                                        border: daysOffset > 0 ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(56, 189, 248, 0.3)',
                                        fontWeight: '700',
                                    }}
                                >
                                    {daysOffset === 0 ? 'BASELINE 2016' : `OFFSET +${daysOffset} HARI`}
                                </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                                Simulasi Siklus Operasional: <strong style={{ color: '#e2e8f0' }}>{modeJaringan ? 'SEMUA TOKO' : `STORE #${currentStore?.id || 74} (${currentStore?.city || 'PAENTMARWY'})`}</strong>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        disabled={isWarping}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            color: '#94a3b8',
                            fontSize: '15px',
                            cursor: isWarping ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                        }}
                        title="Tutup Modal [ESC]"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Active Date Banner ───────────────────────────────────────── */}
                <div
                    style={{
                        padding: '16px 24px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                            TANGGAL SIMULASI AKTIF SAAT INI:
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '20px' }}>📅</span>
                            <span style={{ fontSize: '17px', fontWeight: '800', color: '#f8fafc', letterSpacing: '0.02em' }}>
                                {fullFormattedDate}
                            </span>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                            STATUS SIKLUS:
                        </span>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                color: daysOffset > 0 ? '#fbbf24' : '#34d399',
                                backgroundColor: daysOffset > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: daysOffset > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                            }}
                        >
                            <span
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: daysOffset > 0 ? '#fbbf24' : '#34d399',
                                    boxShadow: daysOffset > 0 ? '0 0 6px #fbbf24' : '0 0 6px #34d399',
                                }}
                            />
                            {daysOffset === 0 ? 'Snapshot As-Of Bibitor' : `Hari Ke-${daysOffset} Simulasi`}
                        </span>
                    </div>
                </div>

                {/* ── Action Buttons Grid ──────────────────────────────────────── */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.05em' }}>
                        PILIH AKSI LOMPATAN WAKTU:
                    </span>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {/* Tombol +1 Hari */}
                        <button
                            onClick={() => handleJumpTime(1)}
                            disabled={isWarping || daysOffset + 1 > hariMaks}
                            style={{
                                padding: '14px 16px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                color: '#f8fafc',
                                cursor: isWarping ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.18s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                            }}
                            onMouseEnter={(e) => {
                                if (isWarping) return;
                                e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.18)';
                                e.currentTarget.style.borderColor = '#fbbf24';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.7)';
                                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#fbbf24' }}>
                                    ⏩ +1 HARI
                                </span>
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>SIKLUS HARIAN</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                                Konsumsi stok harian & mutasi kas toko
                            </span>
                            <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '4px', fontWeight: '700' }}>
                                Target: {next1Day.formatted}
                            </div>
                        </button>

                        {/* Tombol +7 Hari */}
                        <button
                            onClick={() => handleJumpTime(7)}
                            disabled={isWarping || daysOffset + 7 > hariMaks}
                            style={{
                                padding: '14px 16px',
                                borderRadius: '12px',
                                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                color: '#f8fafc',
                                cursor: isWarping ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.18s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                            }}
                            onMouseEnter={(e) => {
                                if (isWarping) return;
                                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.18)';
                                e.currentTarget.style.borderColor = '#38bdf8';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 6px 20px rgba(56, 189, 248, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.7)';
                                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#38bdf8' }}>
                                    ⏭️ +7 HARI
                                </span>
                                <span style={{ fontSize: '10px', color: '#94a3b8' }}>SIKLUS MINGGUAN</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
                                Evaluasi restock mingguan & kuota guardrail
                            </span>
                            <div style={{ fontSize: '10px', color: '#38bdf8', marginTop: '4px', fontWeight: '700' }}>
                                Target: {next7Days.formatted}
                            </div>
                        </button>
                    </div>

                    {/* Tombol mundur (stok kembali seperti tanggal itu; PO dan hold tetap tercatat) */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => handleJumpTime(-1)} disabled={isWarping || daysOffset < 1} style={tombolMundur(1)}>
                            ⏪ -1 HARI
                        </button>
                        <button onClick={() => handleJumpTime(-7)} disabled={isWarping || daysOffset < 1} style={tombolMundur(7)}>
                            ⏮️ -7 HARI {daysOffset > 0 && daysOffset < 7 ? `(ke 31 Des 2016)` : ''}
                        </button>
                    </div>

                    {galat && (
                        <div style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '8px 12px' }}>
                            ⚠️ Waktu tidak bergeser: {galat}
                        </div>
                    )}

                    {/* Tombol Reset Baseline */}
                    <button
                        onClick={handleReset}
                        disabled={isWarping || daysOffset === 0}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            borderRadius: '10px',
                            backgroundColor: daysOffset === 0 ? 'rgba(30, 41, 59, 0.3)' : 'rgba(239, 68, 68, 0.15)',
                            border: daysOffset === 0 ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(239, 68, 68, 0.5)',
                            color: daysOffset === 0 ? '#64748b' : '#f87171',
                            cursor: daysOffset === 0 || isWarping ? 'not-allowed' : 'pointer',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <span>🔄</span>
                        <span>KEMBALI KE 31 DES 2016 (stok awal; PO, hold, dan riwayat agent tetap)</span>
                    </button>
                </div>

                {/* ── Projected Impact Insights Card ───────────────────────────── */}
                <div
                    style={{
                        margin: '0 24px 20px 24px',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(30, 41, 59, 0.45)',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#38bdf8' }}>
                            📊 KONDISI {modeJaringan ? 'SEMUA TOKO' : `TOKO ${storeId}`} PER TANGGAL INI:
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            Data API · sama dengan dashboard
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '10px' }}>
                        <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.6)' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>{modeJaringan ? 'Health rata-rata:' : 'Health Score:'}</span>
                            <strong style={{ color: kondisi ? statusHealth(kondisi.health_score).warna : '#f8fafc', fontSize: '11px' }}>
                                {kondisi ? `${angka(kondisi.health_score)} / 100` : '-'}
                            </strong>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.6)' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>SKU perlu reorder:</span>
                            <strong style={{ color: '#fbbf24', fontSize: '11px' }}>
                                {kondisi ? angka(kondisi.jumlah_status.REORDER ?? 0) : '-'}
                            </strong>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.6)' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>Modal diselamatkan:</span>
                            <strong style={{ color: '#34d399', fontSize: '11px' }}>
                                {kondisi ? rupiahRingkas(kondisi.modal_diselamatkan_idr) : '-'}
                            </strong>
                        </div>
                    </div>
                </div>

                {/* ── Footer Bar ──────────────────────────────────────────────── */}
                <div
                    style={{
                        padding: '12px 24px',
                        background: 'rgba(15, 23, 42, 0.95)',
                        borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#64748b',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                        <span>Koreografi Time Warp: <strong>VFX Distorsi 2.0s di Phaser</strong></span>
                    </div>
                    <div>
                        {!pakaiKontrolSentuh() && (<span>Tekan <kbd style={{ padding: '2px 6px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '4px', color: '#e2e8f0' }}>ESC</kbd> untuk menutup</span>)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TimeSimulationModal;
