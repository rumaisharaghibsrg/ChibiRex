/**
 * CrisisCommandModal.jsx — Tactical Red Alert Emergency Crisis Hub
 *
 * Antarmuka terpadu untuk merespons kondisi darurat toko yang dilaporkan oleh
 * Doni (Koordinator Operasional). Menampilkan telemetri insiden lintas divisi
 * (Maya, Citra, Rian, Pak Budi) dan menyediakan protokol eksekusi resolusi 1-klik.
 */

import React, { useState, useEffect } from 'react';
import { EventBus } from '../game/EventBus';
import { defaultCrisisState, CRISIS_PRESETS } from '../game/StoreCrisisState';
import './CrisisCommandModal.css';

export function CrisisCommandModal({ isOpen, onClose }) {
    const [crisisData, setCrisisData] = useState(() => {
        if (typeof window !== 'undefined' && window.StoreCrisisState) {
            return window.StoreCrisisState;
        }
        return defaultCrisisState;
    });

    const [isResolving, setIsResolving] = useState(false);
    const [resolvedSuccess, setResolvedSuccess] = useState(false);

    // Sinkronisasi data krisis saat modal dibuka atau saat ada event
    useEffect(() => {
        const syncCrisis = () => {
            if (typeof window !== 'undefined' && window.StoreCrisisState) {
                setCrisisData({ ...window.StoreCrisisState });
            }
        };

        syncCrisis();

        const handleTrigger = (e) => {
            setCrisisData(e?.detail ? { ...e.detail } : { ...window.StoreCrisisState });
            setResolvedSuccess(false);
        };

        const handleResolved = () => {
            syncCrisis();
        };

        window.addEventListener('store-crisis-triggered', handleTrigger);
        window.addEventListener('store-crisis-resolved', handleResolved);
        EventBus.on('store-crisis-triggered', handleTrigger);
        EventBus.on('store-crisis-resolved', handleResolved);

        return () => {
            window.removeEventListener('store-crisis-triggered', handleTrigger);
            window.removeEventListener('store-crisis-resolved', handleResolved);
            EventBus.removeListener('store-crisis-triggered', handleTrigger);
            EventBus.removeListener('store-crisis-resolved', handleResolved);
        };
    }, []);

    // Tutup dengan tombol Escape & Universal E Toggle (Directive v4.8)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'e') && isOpen && !isInputTarget) {
                e.preventDefault();
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const handleClose = () => {
        setIsResolving(false);
        setResolvedSuccess(false);
        if (onClose) onClose();
    };

    // Eksekusi Resolusi Darurat 1-Klik
    const handleExecuteResolution = () => {
        setIsResolving(true);

        setTimeout(() => {
            if (typeof window !== 'undefined' && window.resolveStoreCrisis) {
                window.resolveStoreCrisis();
            }
            setIsResolving(false);
            setResolvedSuccess(true);

            setTimeout(() => {
                handleClose();
            }, 1200);
        }, 800);
    };

    // Pemicu Interkom ke NPC Sumber Masalah
    const handleContactSourceViaIntercom = () => {
        if (crisisData.sourceNPC) {
            const intercomPayload = {
                npcId: crisisData.sourceNPC,
                caller: 'rexa',
                duration: 3000,
                topic: crisisData.title,
            };
            window.dispatchEvent(new CustomEvent('npc-intercom-call', { detail: intercomPayload }));
            EventBus.emit('npc-intercom-call', intercomPayload);
        }
        window.dispatchEvent(new CustomEvent('open-smartphone-chat'));
        EventBus.emit('open-smartphone-chat');
        handleClose();
    };

    if (!isOpen) return null;

    const isCrisis = Boolean(crisisData.isCrisis);

    return (
        <div className="crisis-modal-overlay" onClick={handleClose}>
            <div
                className={`crisis-modal-card ${!isCrisis ? 'normal-mode' : ''}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Store Crisis Command Hub"
            >
                {/* ── Top Alert Banner ────────────────────────────────────── */}
                <div className="crisis-top-banner">
                    <div className="crisis-banner-title">
                        <span>{isCrisis ? '🚨' : '🛡️'}</span>
                        <span>{isCrisis ? 'CRISIS DISPATCH · TOKO #74' : 'STATUS OPERASIONAL · TOKO #74'}</span>
                        <span className={isCrisis ? 'crisis-badge-urgent' : 'crisis-badge-normal'}>
                            {isCrisis ? 'URGENT' : 'STABIL'}
                        </span>
                    </div>
                    <button
                        onClick={handleClose}
                        className="crisis-close-btn"
                        title="Tutup (ESC)"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Content Body ────────────────────────────────────────── */}
                <div className="crisis-content-body">
                    {/* Doni Avatar & Speech Bubble */}
                    <div className="crisis-doni-dialog">
                        <div className="crisis-doni-avatar">🏃</div>
                        <div style={{ flex: 1 }}>
                            <div className="crisis-doni-header">
                                <span className="crisis-doni-name">DONI (KOORDINATOR OPERASIONAL)</span>
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                    ● Patroli Lapangan
                                </span>
                            </div>
                            <p className="crisis-doni-text">
                                {resolvedSuccess ? (
                                    <strong style={{ color: '#4ade80' }}>
                                        🎉 "Luar biasa, Manager! Krisis berhasil dinetralisir dan seluruh sistem kembali beroperasi normal. Saya kembali memantau lorong!"
                                    </strong>
                                ) : isCrisis ? (
                                    <>
                                        "Manager! Syukurlah Anda ada di sini! Terjadi kondisi <strong>DARURAT</strong> di divisi{' '}
                                        <strong style={{ color: '#f87171' }}>{crisisData.sourceName}</strong>. Kita harus segera mengeksekusi protokol resolusi sebelum operasional toko terhenti!"
                                    </>
                                ) : (
                                    <>
                                        "Laporan Operasional: Seluruh divisi Toko 74 berjalan tertib dan lancar, Manager! Maya sedang opname di gudang, Citra memantau kas, Rian mengawal server, dan Pak Budi memantau health score. Tidak ada anomali aktif!"
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Telemetry Card (Active Crisis Mode Only) */}
                    {isCrisis && (
                        <div className="crisis-telemetry-card">
                            <div className="crisis-source-tag">
                                <span>⚠️ SUMBER:</span>
                                <span>{crisisData.sourceName}</span>
                                <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>
                                    ({crisisData.sourceLocation || 'Toko 74'})
                                </span>
                            </div>

                            <h3 className="crisis-problem-headline">{crisisData.headline}</h3>

                            {/* Metric Grid */}
                            {crisisData.metrics && (
                                <div className="crisis-metric-grid">
                                    <div className="crisis-metric-col">
                                        <span className="crisis-metric-label">{crisisData.metrics.label}</span>
                                        <span
                                            className="crisis-metric-val"
                                            style={{ color: crisisData.metrics.badgeColor || '#f87171' }}
                                        >
                                            {crisisData.metrics.currentValue}
                                        </span>
                                    </div>
                                    <div className="crisis-metric-col">
                                        <span className="crisis-metric-label">Batas Ambang Toleransi</span>
                                        <span className="crisis-metric-limit">{crisisData.metrics.thresholdValue}</span>
                                    </div>
                                </div>
                            )}

                            <p className="crisis-problem-desc">{crisisData.description}</p>
                        </div>
                    )}
                </div>

                {/* ── Action Footer ───────────────────────────────────────── */}
                <div className="crisis-actions-footer">
                    {isCrisis ? (
                        <>
                            <button
                                onClick={handleExecuteResolution}
                                disabled={isResolving || resolvedSuccess}
                                className="crisis-btn-resolve"
                            >
                                {isResolving ? (
                                    <>
                                        <span className="status-dot pulse-amber" />
                                        <span>MENGEKSEKUSI PROTOKOL DARURAT...</span>
                                    </>
                                ) : resolvedSuccess ? (
                                    <span>✔️ KRISIS TELAH DINETRALISIR!</span>
                                ) : (
                                    <span>{crisisData.action?.label || '⚡ EKSEKUSI PROTOKOL RESOLUSI CEPAT'}</span>
                                )}
                            </button>

                            <div className="crisis-btn-row">
                                <button
                                    onClick={handleContactSourceViaIntercom}
                                    className="crisis-btn-secondary"
                                    title="Hubungi divisi sumber krisis via Smartphone Intercom"
                                >
                                    <span>📞</span>
                                    <span>Hubungi Sumber via Interkom</span>
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="crisis-btn-secondary"
                                >
                                    <span>Tutup (Nanti)</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={handleClose}
                            className="crisis-btn-secondary"
                            style={{ width: '100%', padding: '10px' }}
                        >
                            <span>Tutup Dashboard</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CrisisCommandModal;
