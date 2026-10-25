/**
 * NPCDialogModal.jsx — Panel laporan staf (Maya, Citra, Rian, Pak Budi)
 *
 * Panel melayang, bukan modal: pemain tetap bisa bergerak, dan panel tertutup saat pemain pergi, menekan ✕, atau Esc.
 * Laporan tersimpan di App per (staf, toko) dan muncul lagi saat panel dibuka; "Muat Ulang" mengambil data baru.
 *
 * Menampilkan pesan dialog langsung dari NPC (Maya, Citra, Rian, Pak Budi, Rexa)
 * berdasarkan data API Rexa (src/lib/npc.js):
 * - Titik akhir putih: laporan dari data API.
 * - Titik akhir merah (#ef4444): API tidak terjangkau; teksnya menjelaskan galat, bukan angka pengganti.
 */

import React, { useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { PERSONA } from '../lib/npc';
import './NPCDialogModal.css';

/**
 * Komponen pembungkus teks yang menyematkan indikator Subtle Red Dot jika data berasal dari fallback
 */
export function SentenceWithDot({ text, isFallback }) {
    if (!text) return null;

    // Bersihkan karakter titik di ujung string
    const cleanText = text.replace(/[.\s]+$/, '');

    return (
        <span>
            {cleanText}
            {isFallback ? (
                <span
                    className="subtle-red-dot"
                    style={{ color: '#ef4444', fontWeight: 'bold' }}
                    title="API tidak terjangkau: tidak ada data toko yang ditampilkan"
                >
                    .
                </span>
            ) : (
                <span>.</span>
            )}
        </span>
    );
}

export function NPCDialogModal({
    isOpen,
    npcId = 'maya',
    laporan,
    isLoading = false,
    tanggalSekarang,
    onMuatUlang,
    onClose,
}) {
    const npcConfig = PERSONA[npcId] || PERSONA.maya;
    const activeText = laporan?.dialogue;
    const activeMetrics = laporan?.metrics;
    const isFallback = Boolean(laporan?.gagal);
    const usang = laporan && tanggalSekarang && laporan.tanggal !== tanggalSekarang;

    const handleClose = useCallback(() => {
        if (onClose) onClose();
    }, [onClose]);

    // Esc menutup panel (E dipakai untuk membuka panel staf lain di dekat pemain)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if (e.key === 'Escape' && isOpen && !isInputTarget) handleClose();
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleClose]);

    // Hubungi lewat Smartphone Chat Rexa
    const handleContactViaChat = () => {
        handleClose();
        setTimeout(() => {
            const intercomPayload = {
                npcId: npcConfig.id,
                caller: 'manager',
                duration: 3000,
                topic: npcConfig.role,
            };
            window.dispatchEvent(new CustomEvent('npc-intercom-call', { detail: intercomPayload }));
            EventBus.emit('npc-intercom-call', intercomPayload);
            window.dispatchEvent(new CustomEvent('open-smartphone-chat'));
            EventBus.emit('open-smartphone-chat');
        }, 150);
    };

    if (!isOpen) return null;

    return (
        <div className="npc-panel-bebas">
            <div
                className="npc-dialog-card"
                role="dialog"
                aria-label={`Laporan ${npcConfig.name}`}
            >
                {/* ── Top Header Banner ────────────────────────────────────── */}
                <div className="npc-dialog-header">
                    <div className="npc-header-left">
                        <div
                            className="npc-avatar-box"
                            style={{ borderColor: npcConfig.badgeColor || '#38bdf8' }}
                        >
                            {npcConfig.avatar}
                        </div>
                        <div className="npc-title-box">
                            <span className="npc-name">{npcConfig.name}</span>
                            <span className="npc-role-tag">
                                <span>{npcConfig.role}</span>
                                <span className="npc-location-pill">{npcConfig.location}</span>
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="npc-close-btn"
                        title="Tutup (ESC)"
                        aria-label="Tutup Dialog"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Content Body ────────────────────────────────────────── */}
                <div className="npc-dialog-body">
                    {/* Speech Dialogue Box */}
                    <div
                        className="npc-speech-card"
                        style={{ borderLeftColor: npcConfig.badgeColor || '#38bdf8' }}
                    >
                        <div className="npc-speech-label">
                            <span>💬</span>
                            <span>Laporan {npcConfig.name}{laporan?.tanggal ? ` · data ${laporan.tanggal}` : ''}:</span>
                        </div>
                        {usang && !isLoading && (
                            <div className="npc-usang">
                                Tanggal simulasi sekarang {tanggalSekarang}. Tekan Muat Ulang untuk data terbaru.
                            </div>
                        )}
                        <p className="npc-speech-text">
                            {isLoading && !activeText ? (
                                <span style={{ color: '#94a3b8' }}>
                                    {npcConfig.name} sedang membaca data toko...
                                </span>
                            ) : (
                                <SentenceWithDot text={activeText} isFallback={isFallback} />
                            )}
                        </p>
                    </div>

                    {/* Supporting Metrics Grid */}
                    {activeMetrics && activeMetrics.length > 0 && !(isLoading && !activeText) && (
                        <div className="npc-metrics-grid">
                            {activeMetrics.map((m, idx) => (
                                <div key={idx} className="npc-metric-item">
                                    <span className="npc-metric-label">{m.label}</span>
                                    <span
                                        className="npc-metric-value"
                                        style={{ color: m.color || '#f8fafc' }}
                                    >
                                        {m.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Action Footer ───────────────────────────────────────── */}
                <div className="npc-dialog-footer">
                    <span className="npc-petunjuk">Pergi, ✕, atau Esc untuk menutup; laporan tetap tersimpan.</span>
                    <button
                        onClick={handleContactViaChat}
                        className="npc-btn-secondary"
                        title="Telepon staf ini lewat interkom Smartphone Rexa"
                    >
                        <span>📱</span>
                        <span>Interkom</span>
                    </button>
                    <button
                        onClick={onMuatUlang}
                        disabled={isLoading}
                        className="npc-btn-primary"
                        title="Ambil data terbaru dari API"
                    >
                        <span>{isLoading ? 'Memuat...' : '↻ Muat Ulang'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NPCDialogModal;
