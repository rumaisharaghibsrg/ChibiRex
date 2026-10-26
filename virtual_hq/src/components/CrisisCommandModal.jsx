/**
 * CrisisCommandModal.jsx — Panel Crisis Hub Doni (Koordinator)
 *
 * Doni memeriksa data toko yang diawasi (deteksiKrisis di StoreCrisisState.js) dan hanya melaporkan krisis yang benar-
 * benar ada di data API. Panel melayang, bukan modal: pemain tetap bisa bergerak, dan panel tertutup saat pemain pergi,
 * menekan ✕, atau Esc. Hasil pemeriksaan terakhir disimpan per toko dan muncul lagi saat panel dibuka; "Periksa Ulang"
 * memeriksa data terbaru. Tombol resolusi menjalankan aksi asli: reset circuit breaker oleh manajer, menugaskan Agent
 * Rexa, atau membuka laporan staf sumber masalah.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { defaultCrisisState, deteksiKrisis, deteksiKrisisJaringan, hasilTerakhir } from '../game/StoreCrisisState';
import { useStore } from '../context/StoreContext';
import { useTimeSimulation } from '../context/TimeSimulationContext';
import { api, beritahuDataBerubah } from '../lib/api';
import './CrisisCommandModal.css';

export function CrisisCommandModal({ isOpen, onClose }) {
    const { currentStore, mode } = useStore();
    const { formattedDate } = useTimeSimulation();
    const storeId = currentStore?.id || 74;
    // Mode Semua Toko: Doni memeriksa seluruh jaringan (hasil disimpan dengan kunci 'jaringan').
    const modeJaringan = mode === 'jaringan';
    const kunci = modeJaringan ? 'jaringan' : storeId;
    const labelData = modeJaringan ? 'semua toko' : `Toko ${storeId}`;
    const [crisisData, setCrisisData] = useState(defaultCrisisState);
    const [lainnya, setLainnya] = useState([]);
    const [ringkas, setRingkas] = useState('');
    const [tanggalData, setTanggalData] = useState(null);
    const [memeriksa, setMemeriksa] = useState(false);
    const [galat, setGalat] = useState(null);
    const [isResolving, setIsResolving] = useState(false);
    const [resolvedSuccess, setResolvedSuccess] = useState(false);

    const tampilkan = useCallback((hasil) => {
        setCrisisData(hasil.krisis[0] || defaultCrisisState);
        setLainnya(hasil.krisis.slice(1));
        setRingkas(hasil.ringkas);
        setTanggalData(hasil.tanggal);
    }, []);

    const periksa = useCallback(() => {
        setMemeriksa(true);
        setGalat(null);
        return (modeJaringan ? deteksiKrisisJaringan() : deteksiKrisis(currentStore))
            .then(tampilkan)
            .catch((e) => setGalat(e.message))
            .finally(() => setMemeriksa(false));
    }, [currentStore, modeJaringan, tampilkan]);

    // Saat dibuka (atau toko diganti): tampilkan hasil pemeriksaan terakhir toko ini; periksa hanya kalau belum ada.
    useEffect(() => {
        if (!isOpen) return;
        setResolvedSuccess(false);
        setGalat(null);
        const tersimpan = hasilTerakhir(kunci);
        if (tersimpan) tampilkan(tersimpan);
        else periksa();
    }, [isOpen, kunci, tampilkan, periksa]);

    const handleClose = useCallback(() => {
        setIsResolving(false);
        setResolvedSuccess(false);
        if (onClose) onClose();
    }, [onClose]);

    // Esc menutup panel (E dipakai untuk interaksi lain di dekat pemain)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if (e.key === 'Escape' && isOpen && !isInputTarget) handleClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    // Eksekusi resolusi: aksi asli sesuai jenis krisis
    const handleExecuteResolution = async () => {
        const aksi = crisisData.action || {};
        setGalat(null);
        console.log('[CrisisCommandModal] Executing resolution for crisis:', {
            crisisId: crisisData.crisisId,
            action: aksi,
            storeId,
            modeJaringan,
        });

        if (aksi.jenis === 'reset-breaker') {
            setIsResolving(true);
            try {
                await api.resetBreaker('Reset dari Crisis Hub Doni (Virtual HQ)');
            } catch (e) {
                console.error('[CrisisCommandModal] Reset breaker failed:', e);
                setGalat(e.message);
                setIsResolving(false);
                return;
            }
            window.resolveStoreCrisis?.();
            beritahuDataBerubah();
            setIsResolving(false);
            setResolvedSuccess(true);
            periksa(); // tampilkan kondisi setelah reset; panel tetap terbuka sampai pemain menutupnya
            return;
        }

        if (aksi.jenis === 'agent') {
            setIsResolving(true);
            try {
                const targetStore = String(aksi.store_id || crisisData.store_id || storeId);
                const skuIds = aksi.sku_ids || crisisData.sku_ids || [];
                const crisisType = crisisData.crisisId || aksi.crisis_type || 'CRISIS_STOCKOUT_FAST_MOVING';
                const tugas = aksi.tugas || `Prioritaskan analisis stok kritis untuk Toko ${targetStore}`;

                const agentPayload = {
                    store: targetStore,
                    jaringan: Boolean(modeJaringan),
                    crisis_type: crisisType,
                    sku_ids: skuIds,
                    tugas,
                };

                console.log('[CrisisCommandModal] Dispatching jalankan-agent payload independently:', agentPayload);
                EventBus.emit('jalankan-agent', agentPayload);
                window.dispatchEvent(new CustomEvent('jalankan-agent', { detail: agentPayload }));

                window.resolveStoreCrisis?.();
                setIsResolving(false);
                setResolvedSuccess(true);

                // Beri waktu user melihat konfirmasi sebelum modal ditutup
                setTimeout(() => {
                    handleClose();
                }, 400);
            } catch (e) {
                console.error('[CrisisCommandModal] Failed to dispatch agent task:', e);
                setGalat(`Gagal menugaskan agent: ${e.message}`);
                setIsResolving(false);
            }
            return;
        }

        if (aksi.jenis === 'npc') {
            window.resolveStoreCrisis?.();
            handleClose();
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-npc-dialog-modal', { detail: { npcId: aksi.npcId } }));
            }, 250);
            return;
        }

        // Fallback untuk aksi lain
        window.resolveStoreCrisis?.();
        handleClose();
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
        <div className="crisis-panel-bebas">
            <div
                className={`crisis-modal-card ${!isCrisis ? 'normal-mode' : ''}`}
                role="dialog"
                aria-label="Store Crisis Command Hub"
            >
                {/* ── Top Alert Banner ────────────────────────────────────── */}
                <div className="crisis-top-banner">
                    <div className="crisis-banner-title">
                        <span>{isCrisis ? '🚨' : '🛡️'}</span>
                        <span>{`${isCrisis ? 'CRISIS DISPATCH' : 'STATUS OPERASIONAL'} · ${modeJaringan ? 'SEMUA TOKO' : `TOKO #${storeId}`}`}</span>
                        <span className={isCrisis ? 'crisis-badge-urgent' : 'crisis-badge-normal'}>
                            {memeriksa ? 'MEMERIKSA' : galat && !tanggalData ? 'OFFLINE' : isCrisis ? 'URGENT' : 'STABIL'}
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
                                {memeriksa && !tanggalData ? (
                                    <>"Sebentar, Manager, saya periksa data {labelData} per {formattedDate}..."</>
                                ) : resolvedSuccess ? (
                                    <strong style={{ color: '#4ade80' }}>
                                        🎉 "Circuit breaker sudah direset, Manager. PO baru kembali diproses guardrail seperti biasa."
                                    </strong>
                                ) : galat && !tanggalData ? (
                                    <>"Maaf, Manager, data toko tidak bisa saya baca sekarang: {galat}"</>
                                ) : isCrisis ? (
                                    <>
                                        "Manager, data {labelData} per {tanggalData} menunjukkan kondisi <strong>DARURAT</strong> di bagian{' '}
                                        <strong style={{ color: '#f87171' }}>{crisisData.sourceName}</strong>. Ini angka dari dashboard, bukan perkiraan."
                                    </>
                                ) : (
                                    <>
                                        "Tidak ada krisis di {labelData} per {tanggalData}, Manager. {ringkas}"
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

                            {lainnya.length > 0 && (
                                <p className="crisis-problem-desc" style={{ marginTop: '8px', color: '#94a3b8' }}>
                                    Temuan lain: {lainnya.map((k) => `${k.sourceName.split(' (')[0]}: ${k.headline}`).join(' · ')}
                                </p>
                            )}
                            {galat && (
                                <p className="crisis-problem-desc" style={{ marginTop: '8px', color: '#f87171' }}>⚠️ {galat}</p>
                            )}
                        </div>
                    )}
                </div>

                {tanggalData && tanggalData !== formattedDate && !memeriksa && (
                    <div className="crisis-usang">
                        Diperiksa untuk data {tanggalData}; tanggal simulasi sekarang {formattedDate}. Tekan Periksa Ulang.
                    </div>
                )}
                {galat && tanggalData && <div className="crisis-usang">⚠️ Pemeriksaan terakhir gagal: {galat}</div>}

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
                                        <span>{crisisData.action?.jenis === 'reset-breaker' ? 'MERESET BREAKER...' : 'MENUGASKAN AGENT...'}</span>
                                    </>
                                ) : resolvedSuccess ? (
                                    <span>{crisisData.action?.jenis === 'reset-breaker' ? '✔️ CIRCUIT BREAKER DIRESET' : '✔️ AGENT REXA DITUGASKAN'}</span>
                                ) : (
                                    <span>{crisisData.action?.label || '⚡ Tindak lanjuti'}</span>
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
                                    onClick={periksa}
                                    disabled={memeriksa}
                                    className="crisis-btn-secondary"
                                    title="Periksa ulang data toko dari API"
                                >
                                    <span>{memeriksa ? 'Memeriksa...' : '↻ Periksa Ulang'}</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        <button
                            onClick={periksa}
                            disabled={memeriksa}
                            className="crisis-btn-secondary"
                            style={{ width: '100%', padding: '10px' }}
                            title="Periksa ulang data toko dari API"
                        >
                            <span>{memeriksa ? 'Memeriksa...' : '↻ Periksa Ulang'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CrisisCommandModal;
