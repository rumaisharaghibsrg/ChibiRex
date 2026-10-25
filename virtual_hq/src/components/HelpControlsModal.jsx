/**
 * HelpControlsModal.jsx — Cyberpunk / Enterprise Command Help Dialog
 * 
 * Menampilkan panduan komprehensif navigasi keyboard, interaksi proximity,
 * komunikasi smartphone, dan pintasan manajerial Virtual HQ (Directive v4.6 & v4.7).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { useDeviceDetect } from '../utils/useDeviceDetect';
import './HelpControlsModal.css';

export function HelpControlsModal({ isOpen, onClose }) {
    const { isMobileScreen, isTouch } = useDeviceDetect();
    const [activeTab, setActiveTab] = useState(isMobileScreen || isTouch ? 'mobile' : 'desktop');
    const [showDevCheats, setShowDevCheats] = useState(false);

    useEffect(() => {
        if (isMobileScreen || isTouch) {
            setActiveTab('mobile');
        } else {
            setActiveTab('desktop');
        }
    }, [isMobileScreen, isTouch]);

    const handleClose = useCallback(() => {
        EventBus.emit('unfreeze-player');
        window.dispatchEvent(new CustomEvent('unfreeze-player'));
        if (onClose) onClose();
    }, [onClose]);

    // Listener Keyboard ESC, X, H, & Universal E Toggle (Directive v4.8 & v4.9)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'h' || e.key.toLowerCase() === 'e') && !isInputTarget) {
                e.preventDefault();
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    return (
        <div className="help-modal-overlay" onClick={handleClose}>
            <div className="help-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Header Dialog */}
                <div className="help-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                            }}
                        >
                            ⌨️
                        </div>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#f8fafc', letterSpacing: '0.04em' }}>
                                PANDUAN KONTROL & PINTASAN VIRTUAL HQ
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                                Navigasi Ruangan, Proximity Trigger, dan Perintah Manajerial
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'rgba(30, 41, 59, 0.7)',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            borderRadius: '8px',
                            color: '#94a3b8',
                            width: '30px',
                            height: '30px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#f8fafc';
                            e.currentTarget.style.borderColor = '#38bdf8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#94a3b8';
                            e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.3)';
                        }}
                        title="Tutup Panduan (ESC atau H)"
                    >
                        ✕
                    </button>
                </div>

                {/* Tab Switcher Kontrol Mobile vs Desktop */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '8px 20px 12px 20px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
                }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('mobile')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: activeTab === 'mobile' ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                            background: activeTab === 'mobile' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                            color: activeTab === 'mobile' ? '#38bdf8' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <span>📱</span>
                        <span>Sentuh Mobile (Dual-Thumb)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('desktop')}
                        style={{
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: activeTab === 'desktop' ? '1px solid #38bdf8' : '1px solid rgba(148, 163, 184, 0.2)',
                            background: activeTab === 'desktop' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                            color: activeTab === 'desktop' ? '#38bdf8' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <span>⌨️</span>
                        <span>Keyboard Desktop</span>
                    </button>
                </div>

                {/* Konten Daftar Bantuan */}
                <div className="help-modal-body">
                    {activeTab === 'mobile' ? (
                        <>
                            {/* Mobile Seksi 1: The Thumb Zone */}
                            <div className="help-section">
                                <div className="help-section-title" style={{ color: '#38bdf8' }}>
                                    <span>🕹️ 1. Navigasi Jempol Kiri (Virtual Joystick)</span>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">
                                        Sentuh dan seret lingkaran joystick di pojok kiri bawah untuk menggerakkan avatar 360° secara analog dan halus.
                                    </div>
                                    <div className="help-keys-group">
                                        <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>SERET 360°</span>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Seksi 2: Smart Action Button */}
                            <div className="help-section">
                                <div className="help-section-title" style={{ color: '#fbbf24' }}>
                                    <span>⚡ 2. Interaksi Jempol Kanan (Smart Action Button)</span>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">🦖 <strong>Dekat Meja Rexa:</strong> Tombol berubah warna Cyan · <strong>ANALISIS</strong></div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>TAP</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">📋 <strong>Dekat Meja Manajer:</strong> Tombol berubah Emerald · <strong>REVIEW PO</strong></div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>TAP</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">📺 <strong>Dekat Smart TV:</strong> Tombol berubah Cyan · <strong>REGIONAL</strong></div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#22d3ee', fontWeight: 700 }}>TAP</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">👥 <strong>Dekat Rekan Kerja (Maya, Citra, dll):</strong> Berubah Pink/Ungu · <strong>DIALOG</strong></div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#f43f5e', fontWeight: 700 }}>TAP</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">🏃 <strong>Dekat Doni:</strong> Tombol berubah Merah Pulse · <strong>DONI HUB</strong></div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700 }}>TAP</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">🪑 <strong>Dekat Kursi:</strong> Duduk santai di kursi / berdiri kembali · <strong>DUDUK</strong></div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>TAP</span></div>
                                </div>
                            </div>

                            {/* Mobile Seksi 3: Header & Drawer */}
                            <div className="help-section">
                                <div className="help-section-title" style={{ color: '#34d399' }}>
                                    <span>🧭 3. Menu Navigasi, Rexa Call, & Drawer</span>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">📱 <strong>Tombol Rexa Melayang (Kanan):</strong> Panggil Smartphone Rexa Copilot secara instan (1-Tap)</div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>TAP 📱</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">☰ <strong>Menu Hamburger (Kanan Atas):</strong> Buka Drawer Cabang, Doni Crisis Hub, dan Pengaturan</div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700 }}>TAP [☰]</span></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">📅 <strong>Kapsul Tanggal:</strong> Sentuh tanggal di header untuk membuka panel Simulasi Waktu</div>
                                    <div className="help-keys-group"><span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 700 }}>TAP 📅</span></div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                    {/* Seksi 1: Navigasi Dasar */}
                    <div className="help-section">
                        <div className="help-section-title" style={{ color: '#38bdf8' }}>
                            <span>🧭 1. Navigasi Dasar Avatar (Gerak 8 Arah)</span>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">Berjalan menjelajah ruangan kantor Virtual HQ</div>
                            <div className="help-keys-group">
                                <kbd className="keycap">W</kbd>
                                <kbd className="keycap">A</kbd>
                                <kbd className="keycap">S</kbd>
                                <kbd className="keycap">D</kbd>
                                <span style={{ color: '#64748b', fontSize: '11px', margin: '0 2px' }}>atau</span>
                                <kbd className="keycap">↑</kbd>
                                <kbd className="keycap">←</kbd>
                                <kbd className="keycap">↓</kbd>
                                <kbd className="keycap">→</kbd>
                            </div>
                        </div>
                    </div>

                    {/* Seksi 2: Interaksi Objek & Ruangan Proximity */}
                    <div className="help-section">
                        <div className="help-section-title" style={{ color: '#fbbf24' }}>
                            <span>🎯 2. Interaksi Proximity Objek & Rekan Kerja (&lt; 50px)</span>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">🦖 <strong>Meja Rexa:</strong> Memicu analisis agen AI & draf PO Toko</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">📋 <strong>Meja Manajer:</strong> Review PO & 1-Click SAP Approval</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">📺 <strong>Smart TV:</strong> Buka Regional Dashboard 80 Cabang DuckDB</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">🏃 <strong>Koordinator Doni:</strong> Akses Emergency Crisis Command Hub</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">☕ <strong>Mesin Kopi:</strong> Seduh Espresso segar (Fokus Kerja +100%)</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">🪑 <strong>Kursi Kantor:</strong> Duduk santai di meja / berdiri kembali</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">👥 <strong>Staf Kantor (Maya, Citra, Rian, Budi):</strong> Audit & dialog cepat</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">E</kbd>
                            </div>
                        </div>
                    </div>

                    {/* Seksi 3: Komunikasi & Peralatan Sistem */}
                    <div className="help-section">
                        <div className="help-section-title" style={{ color: '#34d399' }}>
                            <span>🛠️ 3. Komunikasi & Peralatan Sistem</span>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">📱 <strong>Rexa Smartphone:</strong> Handheld Chat Copilot (Interkom AI)</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">C</kbd>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">🏬 <strong>Ganti Cabang:</strong> Klik Kapsul Toko di Header (80 Toko DuckDB)</div>
                            <div className="help-keys-group">
                                <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 'bold' }}>KLIK HEADER</span>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">📅 <strong>Waktu Simulasi:</strong> Klik Kapsul Tanggal (+1 Hari, +7 Hari, Reset)</div>
                            <div className="help-keys-group">
                                <span style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 'bold' }}>KLIK HEADER</span>
                            </div>
                        </div>
                        <div className="help-row">
                            <div className="help-desc">⌨️ <strong>Buka / Tutup Panduan Ini:</strong> Tombol bantuan cepat</div>
                            <div className="help-keys-group">
                                <kbd className="keycap active">X</kbd>
                                <span style={{ color: '#64748b', fontSize: '11px', margin: '0 2px' }}>atau</span>
                                <kbd className="keycap">ESC</kbd>
                            </div>
                        </div>
                    </div>

                    {/* Seksi 4: Hotkey Developer & Simulasi Krisis (Collapsible) */}
                    <div className="help-section" style={{ borderStyle: 'dashed' }}>
                        <div
                            onClick={() => setShowDevCheats((prev) => !prev)}
                            className="help-section-title"
                            style={{ color: '#f87171', cursor: 'pointer', justifyContent: 'space-between' }}
                        >
                            <span>🚨 4. Pintasan Developer & Simulasi Krisis Toko</span>
                            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                {showDevCheats ? '▲ SEMBUNYIKAN' : '▼ TAMPILKAN'}
                            </span>
                        </div>
                        {showDevCheats && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                <div className="help-row">
                                    <div className="help-desc">Picu Krisis: Kehabisan Stok Fast-Moving</div>
                                    <div className="help-keys-group"><kbd className="keycap">1</kbd></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">Picu Krisis: Deadstock & Cashflow Terkunci</div>
                                    <div className="help-keys-group"><kbd className="keycap">2</kbd></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">Picu Krisis: Circuit Breaker Lonjakan Draf PO</div>
                                    <div className="help-keys-group"><kbd className="keycap">3</kbd></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">Picu Krisis: Anomali Health Index Toko Jatuh</div>
                                    <div className="help-keys-group"><kbd className="keycap">4</kbd></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">Toggle Auto-Crisis Organik 30-Menit (On / Off)</div>
                                    <div className="help-keys-group"><kbd className="keycap">U</kbd></div>
                                </div>
                                <div className="help-row">
                                    <div className="help-desc">Quick Restart Game Scene</div>
                                    <div className="help-keys-group"><kbd className="keycap">R</kbd></div>
                                </div>
                            </div>
                        )}
                    </div>
                        </>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="help-modal-footer">
                    <span>Tekan <kbd className="keycap active">X</kbd>, <kbd className="keycap">ESC</kbd>, atau <kbd className="keycap">E</kbd> untuk menutup</span>
                    <span style={{ color: '#38bdf8' }}>CHIBIREX VIRTUAL HQ v2.0</span>
                </div>
            </div>
        </div>
    );
}

export default HelpControlsModal;
