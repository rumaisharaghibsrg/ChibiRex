/**
 * TimeSimulationModal.jsx — Temporal Simulation Engine Modal
 *
 * Mengakomodasi simulasi percepatan waktu operasional toko (+1 Hari, +7 Hari, Reset)
 * dan menampilkan kalkulasi proyeksi penurunan inventaris (Vs velocity decay).
 */

import React, { useEffect, useCallback } from 'react';
import { useTimeSimulation } from '../context/TimeSimulationContext';
import { useStore } from '../context/StoreContext';
import { EventBus } from '../game/EventBus';
import { calculateNewDate, calculateProjectedMetrics, BASELINE_DATE } from '../utils/TimeEngine';

export function TimeSimulationModal({ isOpen, onClose }) {
    const {
        currentSimulatedDate,
        daysOffset,
        isWarping,
        formattedDate,
        fullFormattedDate,
        triggerTimeWarp,
        resetTimeToBaseline,
    } = useTimeSimulation();

    const { currentStore } = useStore();

    // Kalkulasi target tanggal untuk pratinjau tombol
    const next1Day = calculateNewDate(currentSimulatedDate, 1);
    const next7Days = calculateNewDate(currentSimulatedDate, 7);

    // Kalkulasi metrik proyeksi dampak
    const projected = calculateProjectedMetrics(currentStore, daysOffset);

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

    // Eksekusi lompatan waktu
    const handleJumpTime = (days) => {
        if (isWarping) return;
        triggerTimeWarp(days);
        // Langsung tutup modal agar pemain dapat menyaksikan efek Time Warp di kanvas Phaser
        if (onClose) onClose();
    };

    // Eksekusi reset waktu
    const handleReset = () => {
        if (isWarping || daysOffset === 0) return;
        resetTimeToBaseline();
        if (onClose) onClose();
    };

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
                                Simulasi Siklus Operasional: <strong style={{ color: '#e2e8f0' }}>STORE #{currentStore?.id || 74} ({currentStore?.city || 'PAENTMARWY'})</strong>
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
                            disabled={isWarping}
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
                            disabled={isWarping}
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
                        <span>RESET KE BASELINE (31 Des 2016 • Data Original DuckDB)</span>
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
                            📊 PROYEKSI DAMPAK TEMPORAL:
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {daysOffset === 0 ? 'Baseline As-Of' : `Simulasi Hari Ke-${daysOffset}`}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '10px' }}>
                        <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.6)' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>Laju Penjualan (Vs):</span>
                            <strong style={{ color: '#f8fafc', fontSize: '11px' }}>
                                ~{projected.dailyDepletionUnits} unit/hari
                            </strong>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.6)' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>Total Mutasi Keluar:</span>
                            <strong style={{ color: daysOffset > 0 ? '#fbbf24' : '#f8fafc', fontSize: '11px' }}>
                                {projected.totalUnitsDepleted.toLocaleString('id-ID')} unit
                            </strong>
                        </div>
                        <div style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(15, 23, 42, 0.6)' }}>
                            <span style={{ color: '#94a3b8', display: 'block' }}>Kas Terlindungi:</span>
                            <strong style={{ color: '#34d399', fontSize: '11px' }}>
                                Rp {(projected.totalSavedCash / 1000000).toFixed(1)} Juta
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
                        Tekan <kbd style={{ padding: '2px 6px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '4px', color: '#e2e8f0' }}>ESC</kbd> untuk menutup
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TimeSimulationModal;
