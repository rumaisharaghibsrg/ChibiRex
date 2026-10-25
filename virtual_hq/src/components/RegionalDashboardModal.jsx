/**
 * RegionalDashboardModal.jsx — Multi-Tenant Regional Command Center (80 Cabang)
 *
 * Mengakomodasi pengawasan multi-toko regional:
 *  - Menampilkan 80 toko Bibitor dengan Health Score dan SKU perlu reorder dari GET /jaringan/ringkasan
 *  - Pencarian real-time via Store ID (misal: "74", "1", "81") atau Nama Kota (misal: "Ashborne", "Paentmarwy")
 *  - Filter Status dengan ambang dashboard: Sehat (>= 80), Perhatian (65-79), Kritis (< 65)
 *  - Highlight Cabang Aktif dengan Glow Cyan
 *  - Single-Click Store Switching dengan Telemetry Sync trigger
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../context/StoreContext';
import { EventBus } from '../game/EventBus';
import { formatStoreName } from '../data/storesRegistry';
import { angka, statusHealth } from '../lib/format';

const KELOMPOK = {
    SEHAT: (h) => h >= 80,
    PERHATIAN: (h) => h >= 65 && h < 80,
    KRITIS: (h) => h < 65,
};

export function RegionalDashboardModal({ isOpen, onClose }) {
    const { currentStore, storesList, statsTersedia, switchStore } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SEHAT' | 'PERHATIAN' | 'KRITIS'
    const [hoveredStoreId, setHoveredStoreId] = useState(null);

    const jumlahKelompok = useMemo(() => Object.fromEntries(Object.entries(KELOMPOK).map(
        ([k, cocok]) => [k, storesList.filter((s) => s.healthScore !== null && s.healthScore !== undefined && cocok(s.healthScore)).length])),
    [storesList]);

    // Tutup modal dan unfreeze player
    const handleClose = useCallback(() => {
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
        if (onClose) onClose();
    }, [onClose]);

    // Handle ESC & Universal E Toggle key listener (Directive v4.8)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'e') && isOpen && !isInputTarget) {
                e.preventDefault();
                handleClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    // Filter daftar toko
    const filteredStores = useMemo(() => {
        return storesList.filter((s) => {
            const query = searchQuery.trim().toLowerCase();
            const matchesQuery =
                !query ||
                String(s.id).includes(query) ||
                (s.city && s.city.toLowerCase().includes(query));

            if (!matchesQuery) return false;
            if (statusFilter !== 'ALL' && (s.healthScore === null || s.healthScore === undefined || !KELOMPOK[statusFilter](s.healthScore))) {
                return false;
            }
            return true;
        });
    }, [storesList, searchQuery, statusFilter]);

    // Aksi peralihan toko
    const handleSelectStore = (storeId) => {
        if (storeId === currentStore.id) {
            handleClose();
            return;
        }

        // Panggil context switchStore (akan otomatis emit EventBus & update window.CURRENT_STORE)
        switchStore(storeId);

        // Tutup modal agar pemain dapat menyaksikan Telemetry Sync Animation di layar game
        handleClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="regional-modal-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(5, 8, 18, 0.82)',
                backdropFilter: 'blur(14px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px',
                animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={handleClose}
        >
            <div
                className="regional-modal-card"
                style={{
                    width: '100%',
                    maxWidth: '960px',
                    maxHeight: '90vh',
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    fontFamily: 'monospace',
                    color: '#f8fafc',
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
                                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
                                border: '1px solid rgba(56, 189, 248, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '22px',
                                boxShadow: '0 0 15px rgba(56, 189, 248, 0.25)',
                            }}
                        >
                            🖥️
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                    style={{
                                        fontSize: '16px',
                                        fontWeight: '900',
                                        letterSpacing: '0.06em',
                                        background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    REGIONAL COMMAND CENTER
                                </span>
                                <span
                                    style={{
                                        fontSize: '10px',
                                        padding: '2px 8px',
                                        borderRadius: '9999px',
                                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        fontWeight: '700',
                                    }}
                                >
                                    {storesList.length} TOKO
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Pengawasan Saat Ini:</span>
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        color: '#34d399',
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                    }}
                                >
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                                    {formatStoreName(currentStore)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            color: '#94a3b8',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#f8fafc';
                            e.currentTarget.style.borderColor = '#ef4444';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)';
                            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)';
                        }}
                        title="Tutup Modal [ESC]"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Search & Filter Controls Toolbar ─────────────────────────── */}
                <div
                    style={{
                        padding: '14px 24px',
                        background: 'rgba(15, 23, 42, 0.75)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    {/* Search Input Box */}
                    <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '360px' }}>
                        <span
                            style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: '#64748b',
                                fontSize: '14px',
                            }}
                        >
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Cari ID Toko (mis: 74) atau Nama Kota..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                border: '1px solid rgba(148, 163, 184, 0.3)',
                                borderRadius: '8px',
                                color: '#f8fafc',
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                outline: 'none',
                                transition: 'border-color 0.15s ease',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#38bdf8';
                                e.currentTarget.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.2)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '10px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Pills: Status & Health */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setStatusFilter('ALL')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                border: statusFilter === 'ALL' ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                                backgroundColor: statusFilter === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                                color: statusFilter === 'ALL' ? '#38bdf8' : '#94a3b8',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            Semua ({storesList.length})
                        </button>
                        <button
                            onClick={() => setStatusFilter('SEHAT')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                border: statusFilter === 'SEHAT' ? '1px solid #34d399' : '1px solid rgba(148, 163, 184, 0.2)',
                                backgroundColor: statusFilter === 'SEHAT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                                color: statusFilter === 'SEHAT' ? '#34d399' : '#94a3b8',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            🟢 Sehat (≥ 80) ({jumlahKelompok.SEHAT})
                        </button>
                        <button
                            onClick={() => setStatusFilter('PERHATIAN')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                border: statusFilter === 'PERHATIAN' ? '1px solid #fbbf24' : '1px solid rgba(148, 163, 184, 0.2)',
                                backgroundColor: statusFilter === 'PERHATIAN' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                                color: statusFilter === 'PERHATIAN' ? '#fbbf24' : '#94a3b8',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            🟡 Perhatian (65-79) ({jumlahKelompok.PERHATIAN})
                        </button>
                        <button
                            onClick={() => setStatusFilter('KRITIS')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                border: statusFilter === 'KRITIS' ? '1px solid #f87171' : '1px solid rgba(148, 163, 184, 0.2)',
                                backgroundColor: statusFilter === 'KRITIS' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                                color: statusFilter === 'KRITIS' ? '#f87171' : '#94a3b8',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            🔴 Kritis (&lt; 65) ({jumlahKelompok.KRITIS})
                        </button>
                    </div>
                </div>

                {/* ── Stores Card Grid (Scrollable Container) ──────────────────── */}
                <div
                    className="regional-store-grid"
                    style={{
                        flex: '1 1 auto',
                        overflowY: 'auto',
                        padding: '20px 24px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(205px, 1fr))',
                        gap: '14px',
                        alignContent: 'start',
                    }}
                >
                    {filteredStores.length === 0 ? (
                        <div
                            style={{
                                gridColumn: '1 / -1',
                                padding: '40px 20px',
                                textAlign: 'center',
                                color: '#64748b',
                                fontSize: '13px',
                            }}
                        >
                            Tidak ada cabang yang cocok dengan pencarian "{searchQuery}".
                        </div>
                    ) : (
                        filteredStores.map((s) => {
                            const isCurrent = s.id === currentStore.id;
                            const isHovered = hoveredStoreId === s.id;
                            const status = statusHealth(s.healthScore);

                            return (
                                <div
                                    key={s.id}
                                    onClick={() => handleSelectStore(s.id)}
                                    onMouseEnter={() => setHoveredStoreId(s.id)}
                                    onMouseLeave={() => setHoveredStoreId(null)}
                                    style={{
                                        position: 'relative',
                                        backgroundColor: isCurrent
                                            ? 'rgba(56, 189, 248, 0.12)'
                                            : isHovered
                                            ? 'rgba(30, 41, 59, 0.85)'
                                            : 'rgba(30, 41, 59, 0.5)',
                                        border: isCurrent
                                            ? '2px solid #38bdf8'
                                            : isHovered
                                            ? '1px solid rgba(56, 189, 248, 0.6)'
                                            : '1px solid rgba(148, 163, 184, 0.15)',
                                        borderRadius: '12px',
                                        padding: '12px 14px',
                                        cursor: 'pointer',
                                        transition: 'all 0.18s ease-in-out',
                                        transform: isHovered && !isCurrent ? 'translateY(-2px)' : 'none',
                                        boxShadow: isCurrent
                                            ? '0 0 20px rgba(56, 189, 248, 0.35)'
                                            : isHovered
                                            ? '0 8px 20px rgba(0, 0, 0, 0.4)'
                                            : 'none',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        minHeight: '130px',
                                    }}
                                >
                                    {/* Store Card Header */}
                                    <div>
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginBottom: '6px',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '11px',
                                                    fontWeight: '800',
                                                    color: isCurrent ? '#38bdf8' : '#cbd5e1',
                                                    letterSpacing: '0.04em',
                                                }}
                                            >
                                                STORE #{s.id < 10 ? `0${s.id}` : s.id}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '9px',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    backgroundColor: 'rgba(148, 163, 184, 0.15)',
                                                    color: '#94a3b8',
                                                }}
                                            >
                                                {status.label}
                                            </span>
                                        </div>

                                        {/* City Name */}
                                        <div
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: '800',
                                                color: '#f8fafc',
                                                letterSpacing: '0.02em',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                marginBottom: '8px',
                                            }}
                                            title={s.city}
                                        >
                                            {s.city}
                                        </div>

                                        {/* Key Metrics */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: '10px',
                                                color: '#94a3b8',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            <span>SKU Aktif:</span>
                                            <strong style={{ color: '#e2e8f0' }}>
                                                {s.skuCount?.toLocaleString('id-ID') || '—'}
                                            </strong>
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: '10px',
                                                color: '#94a3b8',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            <span>Perlu reorder:</span>
                                            <strong style={{ color: '#e2e8f0' }}>{angka(s.reorderNeededCount)}</strong>
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: '10px',
                                                color: '#94a3b8',
                                            }}
                                        >
                                            <span>Health:</span>
                                            <strong style={{ color: status.warna }}>
                                                {s.healthScore ?? '-'} / 100
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Action Button / Active State Pill */}
                                    <div style={{ marginTop: '10px' }}>
                                        {isCurrent ? (
                                            <div
                                                style={{
                                                    width: '100%',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: 'rgba(56, 189, 248, 0.25)',
                                                    border: '1px solid #38bdf8',
                                                    color: '#38bdf8',
                                                    fontSize: '10px',
                                                    fontWeight: '800',
                                                    textAlign: 'center',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '5px',
                                                }}
                                            >
                                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#38bdf8' }} />
                                                SEDANG AKTIF
                                            </div>
                                        ) : (
                                            <div
                                                style={{
                                                    width: '100%',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: isHovered
                                                        ? 'rgba(56, 189, 248, 0.2)'
                                                        : 'rgba(15, 23, 42, 0.6)',
                                                    border: isHovered
                                                        ? '1px solid rgba(56, 189, 248, 0.6)'
                                                        : '1px solid rgba(148, 163, 184, 0.2)',
                                                    color: isHovered ? '#38bdf8' : '#94a3b8',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                    textAlign: 'center',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                {isHovered ? '⚡ HUBUNGKAN CABANG' : 'Pilih Cabang'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
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
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                        <span>{statsTersedia
                            ? <>Health Score per tanggal simulasi dari API (sama dengan dashboard)</>
                            : <>Health Score belum tersedia: API belum punya <strong>/jaringan/ringkasan</strong> atau tidak terjangkau</>}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span>Tekan <kbd style={{ padding: '2px 6px', background: 'rgba(30, 41, 59, 0.9)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '4px', color: '#e2e8f0' }}>ESC</kbd> untuk menutup</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RegionalDashboardModal;
