import React from 'react';

/**
 * MobileDrawerMenu - Off-canvas navigation drawer untuk layar mobile (< 768px).
 * Mengintegrasikan semua kontrol sekunder (Store Switcher, Rexa Chat, Doni Hub, Time Engine, Help)
 * dengan tap target ramah sentuhan (Touch-Friendly >= 44px).
 */
export default function MobileDrawerMenu({
    isOpen,
    onClose,
    currentStore,
    onOpenRegionalModal,
    onOpenTimeModal,
    onToggleChat,
    onOpenCrisisModal,
    onOpenHelpModal,
    isChatOpen,
    isCrisisActive,
    agentRunning,
    formattedDate,
    daysOffset,
    stepCount,
    apiOnline,
    dashboardHref,
}) {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'flex-end',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu Navigasi Mobile"
        >
            {/* Backdrop Blur Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(5, 7, 15, 0.65)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    animation: 'fadeIn 0.2s ease-out',
                }}
            />

            {/* Slide-out Drawer Panel */}
            <div
                style={{
                    position: 'relative',
                    width: '82%',
                    maxWidth: '320px',
                    height: '100%',
                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderLeft: '1px solid rgba(56, 189, 248, 0.25)',
                    boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(20px + env(safe-area-inset-bottom, 0px)) 16px',
                    gap: '16px',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                {/* Drawer Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🦖</span>
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '14px', color: '#f1f5f9', letterSpacing: '0.04em' }}>
                                CHIBIREX HQ
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                                MOBILE COMMAND
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            background: 'rgba(30, 41, 59, 0.5)',
                            color: '#94a3b8',
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        aria-label="Tutup Menu"
                    >
                        ✕
                    </button>
                </div>

                {/* Section: Status Patroli */}
                <div style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    backgroundColor: agentRunning ? 'rgba(245, 158, 11, 0.12)' : 'rgba(30, 41, 59, 0.6)',
                    border: agentRunning ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(71, 85, 105, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}>
                    <span className={`status-dot ${agentRunning ? 'pulse-amber' : 'live'}`} />
                    <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                        <div style={{ color: agentRunning ? '#fbbf24' : '#94a3b8', fontWeight: 700 }}>
                            {agentRunning ? `⚡ PATROLI AKTIF #${stepCount || 1}` : '🟢 SISTEM STANDBY'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '10px' }}>
                            {agentRunning ? 'Rexa mengeksekusi inspeksi...' : 'Siap patroli toko'}
                        </div>
                    </div>
                </div>

                {/* Section: Pilihan Toko */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Cabang Pengawasan
                    </div>
                    <button
                        onClick={() => { onClose(); onOpenRegionalModal(); }}
                        style={{
                            minHeight: '44px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            color: '#34d399',
                            cursor: 'pointer',
                            textAlign: 'left',
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '12px' }}>
                                🏬 STORE #{currentStore?.id || 74}
                            </div>
                            <div style={{ fontSize: '10px', color: '#a7f3d0' }}>
                                {currentStore?.city || 'PAENTMARWY'} · 80 Toko
                            </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#6ee7b7' }}>GANTI ▼</span>
                    </button>
                </div>

                {/* Section: Aksi Utama */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Menu Cepat
                    </div>

                    {/* Doni Crisis Hub */}
                    <button
                        onClick={() => { onClose(); onOpenCrisisModal(); }}
                        style={{
                            minHeight: '46px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: isCrisisActive ? 'rgba(239, 68, 68, 0.85)' : 'rgba(30, 41, 59, 0.7)',
                            border: isCrisisActive ? '1px solid #f87171' : '1px solid rgba(148, 163, 184, 0.2)',
                            color: isCrisisActive ? '#ffffff' : '#fb923c',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                            boxShadow: isCrisisActive ? '0 0 16px rgba(239, 68, 68, 0.5)' : 'none',
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>🚨</span>
                        <span>{isCrisisActive ? 'Crisis Hub (KRISIS AKTIF!)' : 'Doni Crisis Command Hub'}</span>
                    </button>

                    {/* Simulasi Waktu */}
                    <button
                        onClick={() => { onClose(); onOpenTimeModal(); }}
                        style={{
                            minHeight: '46px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: daysOffset > 0 ? 'rgba(245, 158, 11, 0.18)' : 'rgba(30, 41, 59, 0.7)',
                            border: daysOffset > 0 ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(148, 163, 184, 0.2)',
                            color: daysOffset > 0 ? '#fbbf24' : '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '18px' }}>📅</span>
                            <span>Simulasi Waktu</span>
                        </div>
                        <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: daysOffset > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(148, 163, 184, 0.2)',
                            color: daysOffset > 0 ? '#fbbf24' : '#94a3b8',
                        }}>
                            {formattedDate}
                        </span>
                    </button>

                    {/* Kembali ke dashboard web */}
                    <a
                        href={dashboardHref}
                        style={{
                            minHeight: '46px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(52, 211, 153, 0.4)',
                            color: '#6ee7b7',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>📊</span>
                        <span>Kembali ke Dashboard</span>
                    </a>

                    {/* Panduan & Bantuan */}
                    <button
                        onClick={() => { onClose(); onOpenHelpModal(); }}
                        style={{
                            minHeight: '46px',
                            padding: '10px 14px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(30, 41, 59, 0.7)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            color: '#94a3b8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>❓</span>
                        <span>Panduan Kontrol Touch</span>
                    </button>
                </div>

                {/* Footer Info */}
                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>
                        API: <span style={{ color: apiOnline === false ? '#f87171' : '#38bdf8' }}>
                            {apiOnline === null ? 'MEMERIKSA' : apiOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>
                        v2.0 Mobile
                    </div>
                </div>
            </div>
        </div>
    );
}
