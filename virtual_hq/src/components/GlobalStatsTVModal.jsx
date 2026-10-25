/**
 * GlobalStatsTVModal.jsx — Smart TV: Dual-State Responsive UI (1/8 Peek & 1/4 Inspect)
 *
 * Menerapkan spesifikasi transformatif:
 *  1. STATE PEEK (1/8 Layar Game):
 *     - Popup minimalis di sudut kanan atas kanvas game saat player mendekati TV (< 50px).
 *     - Player TIDAK dibekukan (tetap bebas berjalan).
 *     - Menampilkan metrik ringkas (Rp 124.5M Omset, 842 Trx) dan petunjuk [E] Inspect.
 *  2. STATE INSPECT (1/4 Layar Game):
 *     - Membesar secara mulus (smooth CSS transition all 0.3s ease-in-out) saat [E] ditekan.
 *     - Menjadi panel sidebar kanan di dalam viewport game aktif.
 *     - Player dibekukan.
 *     - Menampilkan visual Bar Chart tren omset 7 hari, 4 kartu KPI, kategori produk, dan status AI.
 *     - Penutupan via tombol [X] atau tombol keyboard [ESC] mengembalikan kontrol gerak pemain.
 *  3. KONTEN RELATIF KANVAS GAME:
 *     - 100% position: absolute di dalam container viewport game aktif, tidak pernah meluber ke letterbox.
 */

import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { EventBus } from '../game/EventBus';

export function GlobalStatsTVModal({ mode = 'hidden', onInspect, onClose }) {
    const { currentStore } = useStore();
    const [hoveredBar, setHoveredBar] = useState(null);

    // ── Tangani Tombol ESC dan Universal E Toggle untuk Interaksi (Directive v4.8) ─
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if (isInputTarget) return;

            if ((e.key === 'Escape' || e.key.toLowerCase() === 'e') && mode === 'inspect') {
                e.preventDefault();
                if (onClose) onClose();
            } else if ((e.key === 'e' || e.key === 'E') && mode === 'peek') {
                e.preventDefault();
                if (onInspect) onInspect();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mode, onInspect, onClose]);

    // Data 7 Hari Terakhir untuk Visual Bar Chart
    const weeklyData = [
        { day: 'Sen', amount: 98.2,  orders: 680 },
        { day: 'Sel', amount: 105.4, orders: 720 },
        { day: 'Rab', amount: 112.0, orders: 765 },
        { day: 'Kam', amount: 118.5, orders: 810 },
        { day: 'Jum', amount: 135.2, orders: 895 },
        { day: 'Sab', amount: 142.0, orders: 940 },
        { day: 'Min', amount: 124.5, orders: 842, isToday: true },
    ];
    const maxAmount = 160;

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
                            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '-2px' }}>Omset Toko</span>
                            <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
                                Rp 124.5M
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginBottom: '-2px' }}>Transaksi</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#a78bfa', fontFamily: 'monospace' }}>
                                842 Trx
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
                                    STORE #{currentStore?.id || 74} ({currentStore?.city || 'PAENTMARWY'}) • Telemetry
                                </span>
                            </div>
                        </div>

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
                        {/* 4 Kartu KPI Grid 2x2 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(56, 189, 248, 0.18)',
                                }}
                            >
                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: '700' }}>
                                    OMSET HARI INI
                                </span>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: '3px 0 1px' }}>
                                    Rp 124.5M
                                </div>
                                <span style={{ fontSize: '9px', color: '#34d399' }}>▲ +18.4% target</span>
                            </div>

                            <div
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(167, 139, 250, 0.18)',
                                }}
                            >
                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#a78bfa', fontWeight: '700' }}>
                                    TRANSAKSI
                                </span>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: '3px 0 1px' }}>
                                    842 <span style={{ fontSize: '10px', color: '#94a3b8' }}>Struk</span>
                                </div>
                                <span style={{ fontSize: '9px', color: '#94a3b8' }}>Rp 147.8k/struk</span>
                            </div>

                            <div
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(52, 211, 153, 0.18)',
                                }}
                            >
                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#34d399', fontWeight: '700' }}>
                                    OTIF SERVICE
                                </span>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: '3px 0 1px' }}>
                                    96.8%
                                </div>
                                <span style={{ fontSize: '9px', color: '#34d399' }}>● Risk Rendah</span>
                            </div>

                            <div
                                style={{
                                    padding: '10px 12px',
                                    borderRadius: '10px',
                                    background: 'rgba(15, 23, 42, 0.6)',
                                    border: '1px solid rgba(244, 114, 182, 0.18)',
                                }}
                            >
                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#f472b6', fontWeight: '700' }}>
                                    KAS HEMAT
                                </span>
                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: '3px 0 1px' }}>
                                    Rp 48.2M
                                </div>
                                <span style={{ fontSize: '9px', color: '#f472b6' }}>14 SKU Fast</span>
                            </div>
                        </div>

                        {/* Visual Bar Chart 7 Hari */}
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: '12px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(56, 189, 248, 0.18)',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#e2e8f0' }}>
                                    📈 TREN OMSET 7 HARI (JUTA IDR)
                                </span>
                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: '#38bdf8' }}>
                                    Min: Hari Ini
                                </span>
                            </div>

                            <div
                                style={{
                                    height: '110px',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    justifyContent: 'space-between',
                                    gap: '6px',
                                    paddingBottom: '20px',
                                    borderBottom: '1px dashed rgba(148, 163, 184, 0.2)',
                                    position: 'relative',
                                }}
                            >
                                {weeklyData.map((item, index) => {
                                    const heightPercent = Math.round((item.amount / maxAmount) * 100);
                                    const isHovered = hoveredBar === index;
                                    return (
                                        <div
                                            key={item.day}
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
                                            onMouseEnter={() => setHoveredBar(index)}
                                            onMouseLeave={() => setHoveredBar(null)}
                                        >
                                            {/* Tooltip Mini */}
                                            {isHovered && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: `${heightPercent + 14}%`,
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
                                                    Rp {item.amount}M
                                                </div>
                                            )}

                                            {/* Bar Element */}
                                            <div
                                                className="tv-interactive-bar"
                                                style={{
                                                    width: '100%',
                                                    maxWidth: '30px',
                                                    height: `${heightPercent}%`,
                                                    background: item.isToday
                                                        ? 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)'
                                                        : 'linear-gradient(180deg, rgba(6, 182, 212, 0.7) 0%, rgba(30, 41, 59, 0.8) 100%)',
                                                    borderRadius: '4px 4px 1px 1px',
                                                    borderTop: `2px solid ${item.isToday ? '#7dd3fc' : '#22d3ee'}`,
                                                    boxShadow: item.isToday
                                                        ? '0 0 10px rgba(56, 189, 248, 0.45)'
                                                        : 'none',
                                                    transition: 'all 0.2s ease',
                                                }}
                                            />

                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '-18px',
                                                    fontSize: '9px',
                                                    fontFamily: 'monospace',
                                                    color: item.isToday ? '#38bdf8' : '#94a3b8',
                                                    fontWeight: item.isToday ? 'bold' : 'normal',
                                                }}
                                            >
                                                {item.day}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Breakdown Kategori Produk */}
                        <div
                            style={{
                                padding: '12px 14px',
                                borderRadius: '12px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(56, 189, 248, 0.18)',
                            }}
                        >
                            <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
                                🛒 KONTRIBUSI KATEGORI
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {[
                                    { name: 'F&B / Groceries', percent: 48, val: 'Rp 59.8M', color: '#06b6d4' },
                                    { name: 'Personal Care', percent: 26, val: 'Rp 32.4M', color: '#3b82f6' },
                                    { name: 'Household', percent: 18, val: 'Rp 22.4M', color: '#10b981' },
                                    { name: 'Fresh Produce', percent: 8, val: 'Rp 9.9M', color: '#f59e0b' },
                                ].map((cat) => (
                                    <div key={cat.name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', marginBottom: '2px' }}>
                                            <span style={{ color: '#cbd5e1' }}>{cat.name}</span>
                                            <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{cat.percent}%</span>
                                        </div>
                                        <div style={{ height: '4px', background: 'rgba(30, 41, 59, 0.7)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{ width: `${cat.percent}%`, height: '100%', background: cat.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Status Ekosistem AI Agent */}
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
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#cbd5e1' }}>🤖 Rexa AI Copilot</span>
                                <span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: '700' }}>ACTIVE</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#cbd5e1' }}>📦 Maya Auditor Stok</span>
                                <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontWeight: '700' }}>CONF 98.5%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#cbd5e1' }}>🛡️ Rian Guardrail</span>
                                <span style={{ color: '#34d399', fontFamily: 'monospace', fontWeight: '700' }}>SECURE</span>
                            </div>
                        </div>
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
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
