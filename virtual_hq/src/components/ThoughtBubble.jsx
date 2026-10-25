/**
 * ThoughtBubble.jsx — Visualisasi Pemikiran Agen Rexa (React Component)
 *
 * Ditampilkan melayang di atas sprite Rexa pada koordinat layar yang sinkron dengan Phaser.
 * Menampilkan status analitik, langkah tool terbaru dengan styling futuristik,
 * dan ringkasan eksekutif; bubble hanya ditutup pemain (✕, Esc, atau bergeser).
 */

import React from 'react';
import { SentenceWithDot } from './NPCDialogModal';
import { pakaiKontrolSentuh } from '../utils/perangkat';

// Kamus alat agen untuk tampilan ramah pengguna
const TOOL_INFO = {
    list_prioritas: {
        icon: '🔍',
        label: 'Menganalisis SKU Prioritas Toko',
        color: '#38bdf8',
    },
    get_sku_metrics: {
        icon: '📊',
        label: 'Membaca Metrik & Data Confidence SKU',
        color: '#a78bfa',
    },
    check_substitution: {
        icon: '🔗',
        label: 'Cek Peran Komplementer (Market Basket)',
        color: '#fbbf24',
    },
    hold_reorder: {
        icon: '⏸️',
        label: 'Menahan Reorder Slow-Moving (Stok Uji 10%)',
        color: '#f97316',
    },
    suggest_reallocation: {
        icon: '💰',
        label: 'Menghitung Pengalihan Modal Kas',
        color: '#34d399',
    },
    draft_purchase_order: {
        icon: '📋',
        label: 'Menyusun Draf Purchase Order',
        color: '#60a5fa',
    },
};

// Baris aksi setelah run selesai: bubble tidak tertutup otomatis; hasil tetap tersimpan setelah ditutup.
function AksiHasil({ onJalankanUlang, warna }) {
    return (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '9px', lineHeight: 1.4 }}>
                {pakaiKontrolSentuh() ? 'Geser atau ✕' : 'Geser, ✕, atau Esc'} untuk menutup. Hasil tetap tersimpan (klik status di header untuk membuka lagi).
            </span>
            <button
                onClick={onJalankanUlang}
                style={{
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${warna}`,
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: warna,
                    fontSize: '10px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                }}
            >
                ↻ Jalankan Ulang
            </button>
        </div>
    );
}

export function ThoughtBubble({
    visible,
    status,
    currentStep,
    stepCount,
    summary,
    errorMessage,
    screenPos,
    isFallback = false,
    onTutup,
    onJalankanUlang,
}) {
    if (!visible) return null;

    // Hitung posisi absolut di atas sprite Rexa. Rexa duduk di tepi atas peta, jadi kalau ruang di atasnya tidak
    // cukup, bubble tampil di bawah sprite supaya langkah dan pesan agent tetap terbaca.
    const bubbleX = screenPos ? Math.max(180, Math.min(screenPos.x, 780)) : 220;
    const diBawah = Boolean(screenPos) && screenPos.y < 330;
    const bubbleY = screenPos ? (diBawah ? screenPos.y + 36 : Math.max(65, screenPos.y - 12)) : 100;

    const isDone    = status === 'SELESAI' || isFallback;
    const isRunning = (status === 'BERJALAN' || status === 'MEMULAI') && !isDone;
    const isError   = status === 'GAGAL' && !isFallback;
    const warnaEkor = isDone ? 'rgba(52, 211, 153, 0.96)' : isError ? 'rgba(248, 113, 113, 0.96)' : 'rgba(245, 158, 11, 0.96)';

    const toolMeta = currentStep?.tool ? (TOOL_INFO[currentStep.tool] || {
        icon: '⚡',
        label: `${currentStep.tool}()`,
        color: '#38bdf8',
    }) : null;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${bubbleX}px`,
                top: `${bubbleY}px`,
                transform: diBawah ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                zIndex: 1000,
                pointerEvents: 'auto',
                width: '360px',
                maxWidth: '92vw',
                backgroundColor: 'rgba(15, 17, 32, 0.96)',
                backdropFilter: 'blur(16px)',
                border: isDone 
                    ? '1px solid rgba(52, 211, 153, 0.6)' 
                    : isError 
                    ? '1px solid rgba(248, 113, 113, 0.6)' 
                    : '1px solid rgba(245, 158, 11, 0.6)',
                borderRadius: '14px',
                boxShadow: isDone
                    ? '0 12px 35px rgba(52, 211, 153, 0.25), 0 0 0 1px rgba(255,255,255,0.06)'
                    : isError
                    ? '0 12px 35px rgba(248, 113, 113, 0.25), 0 0 0 1px rgba(255,255,255,0.06)'
                    : '0 12px 35px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(255,255,255,0.06)',
                padding: '14px 16px',
                color: '#f8fafc',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: '12px',
                lineHeight: '1.45',
                animation: `${diBawah ? 'bubble-pop-bawah' : 'bubble-pop'} 0.25s cubic-bezier(0.16, 1, 0.3, 1)`,
                transition: 'all 0.3s ease',
            }}
        >
            {/* ── Header: Nama Agen, Live Pulse & Status Badge ───────────── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingBottom: '10px',
                    marginBottom: '10px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                        }}
                    >
                        🤖
                    </div>
                    <div>
                        <div style={{ color: '#fbbf24', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>
                            REXA COPILOT
                        </div>
                        <div style={{ color: '#64748b', fontSize: '9px', fontWeight: '500' }}>
                            Autonomous Agentic Loop
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        fontSize: '10px',
                        padding: '3px 9px',
                        borderRadius: '20px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        letterSpacing: '0.3px',
                        backgroundColor: isDone
                            ? 'rgba(52, 211, 153, 0.15)'
                            : isError
                            ? 'rgba(248, 113, 113, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color: isDone ? '#34d399' : isError ? '#f87171' : '#fbbf24',
                        border: `1px solid ${isDone ? 'rgba(52, 211, 153, 0.4)' : isError ? 'rgba(248, 113, 113, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                    }}
                >
                    {isRunning && (
                        <span
                            style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#fbbf24',
                                animation: 'dot-pulse 0.9s infinite alternate',
                            }}
                        />
                    )}
                    {isFallback ? 'SELESAI' : (status || 'MEMULAI')}
                </div>
                {onTutup && (
                    <button
                        onClick={onTutup}
                        title="Tutup (Esc): lanjut berjalan, agent tetap bekerja di latar"
                        aria-label="Tutup bubble agent"
                        style={{
                            marginLeft: '8px',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            border: '1px solid rgba(148, 163, 184, 0.35)',
                            background: 'rgba(30, 41, 59, 0.8)',
                            color: '#cbd5e1',
                            fontSize: '10px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {pakaiKontrolSentuh() ? '✕' : '✕ Esc'}
                    </button>
                )}
            </div>

            {/* ── Konten Pemikiran: Saat Analisis Sedang Berjalan ─────────── */}
            {isRunning && (
                <div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            color: '#94a3b8',
                            fontSize: '11px',
                            marginBottom: '8px',
                        }}
                    >
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                border: '2px solid rgba(245, 158, 11, 0.25)',
                                borderTop: '2px solid #fbbf24',
                                borderRadius: '50%',
                                animation: 'spin 0.7s linear infinite',
                                flexShrink: 0,
                            }}
                        />
                        <span>
                            {stepCount > 0 ? `Siklus ${stepCount}: Mengeksekusi tindakan...` : 'Menghubungkan ke AI Engine & Bedrock...'}
                        </span>
                    </div>

                    {currentStep && (
                        <div
                            style={{
                                backgroundColor: 'rgba(24, 28, 48, 0.75)',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                borderLeft: `3px solid ${toolMeta?.color || '#fbbf24'}`,
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                borderLeftWidth: '3px',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <div style={{ color: toolMeta?.color || '#38bdf8', fontWeight: '700', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>{toolMeta?.icon || '⚡'}</span>
                                    <span>{toolMeta?.label || currentStep.tool}</span>
                                </div>
                                {currentStep.detik !== undefined && (
                                    <span style={{ color: '#64748b', fontSize: '10px' }}>
                                        ⏱️ {currentStep.detik}s
                                    </span>
                                )}
                            </div>

                            {currentStep.input && (
                                <div
                                    style={{
                                        color: '#cbd5e1',
                                        fontSize: '10px',
                                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                        marginTop: '4px',
                                        wordBreak: 'break-all',
                                    }}
                                >
                                    <span style={{ color: '#64748b' }}>args: </span>
                                    {Object.entries(currentStep.input).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Konten Pemikiran: Saat Selesai ─────────────────────────── */}
            {isDone && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontWeight: '700', fontSize: '12px', marginBottom: '8px' }}>
                        <span>✨</span>
                        <span>Analisis Selesai — Rekomendasi Terbentuk</span>
                    </div>

                    <div
                        style={{
                            color: '#e2e8f0',
                            fontSize: '11px',
                            maxHeight: '140px',
                            overflowY: 'auto',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            whiteSpace: 'pre-line',
                            lineHeight: '1.5',
                        }}
                    >
                        <SentenceWithDot
                            text={summary || 'Tinjauan toko selesai. Draf PO siap diperiksa di Meja Manajer.'}
                            isFallback={isFallback}
                        />
                    </div>

                    {/* Progress Bar Countdown Penutupan */}
                    {onJalankanUlang && <AksiHasil onJalankanUlang={onJalankanUlang} warna="#34d399" />}
                </div>
            )}

            {/* ── Konten Pemikiran: Saat Error / Gagal ────────────────────── */}
            {isError && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171', fontWeight: '700', fontSize: '12px', marginBottom: '8px' }}>
                        <span>⚠️</span>
                        <span>Analisis Agen Terkendala</span>
                    </div>
                    <div
                        style={{
                            color: '#fca5a5',
                            fontSize: '11px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            borderLeft: '3px solid #f87171',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            lineHeight: '1.4',
                        }}
                    >
                        {errorMessage || 'Agent gagal dijalankan.'}
                    </div>

                    {onJalankanUlang && <AksiHasil onJalankanUlang={onJalankanUlang} warna="#f87171" />}
                </div>
            )}

            {/* ── Pointer / Ekor Bubble ke arah Rexa ──────────────────────── */}
            <div
                style={{
                    position: 'absolute',
                    ...(diBawah ? { top: '-9px' } : { bottom: '-9px' }),
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '9px solid transparent',
                    borderRight: '9px solid transparent',
                    ...(diBawah ? { borderBottom: `9px solid ${warnaEkor}` } : { borderTop: `9px solid ${warnaEkor}` }),
                }}
            />

            {/* CSS Keyframe Animations */}
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes dot-pulse {
                        0% { opacity: 0.3; transform: scale(0.8); }
                        100% { opacity: 1; transform: scale(1.2); }
                    }
                    @keyframes bubble-pop {
                        0% { opacity: 0; transform: translate(-50%, -85%) scale(0.92); }
                        100% { opacity: 1; transform: translate(-50%, -100%) scale(1); }
                    }
                    @keyframes bubble-pop-bawah {
                        0% { opacity: 0; transform: translate(-50%, -6%) scale(0.92); }
                        100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
                    }
                `}
            </style>
        </div>
    );
}
