/**
 * AgentJaringanBubble.jsx — Bubble Agent Jaringan di dekat Rexa (mode Semua Toko)
 *
 * Agent Jaringan (Lambda Copilot, POST /jaringan, Claude Sonnet) membaca statistik semua toko, membuka toko yang paling
 * bermasalah, lalu menetapkan 3-5 toko prioritas dan transfer stok antar toko. Hanya membaca: PO tetap dibuat agent
 * toko dan disetujui manajer. Bubble tidak tertutup otomatis; "Jalankan Ulang" menjalankan analisis baru.
 */

import React from 'react';
import { angka, rupiah, statusHealth } from '../lib/format';
import { formatIndonesianDate } from '../utils/TimeEngine';
import { pakaiKontrolSentuh } from '../utils/perangkat';

const tombol = (warna) => ({
    padding: '4px 9px',
    borderRadius: '7px',
    border: `1px solid ${warna}`,
    background: 'rgba(15, 23, 42, 0.9)',
    color: warna,
    fontSize: '10px',
    fontWeight: '800',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
});

export function AgentJaringanBubble({
    visible,
    berjalan,
    detik,
    laporan,
    galat,
    tanggalSekarang, // ISO tanggal simulasi sekarang
    screenPos,
    onTutup,
    onJalankanUlang,
    onBukaToko,
}) {
    if (!visible) return null;
    const sentuh = pakaiKontrolSentuh(); // tanpa petunjuk Esc di HP/tablet

    // Posisi seperti bubble agent toko: di atas Rexa, atau di bawahnya kalau Rexa dekat tepi atas layar.
    const bubbleX = screenPos ? Math.max(220, Math.min(screenPos.x, 800)) : 240;
    const diBawah = Boolean(screenPos) && screenPos.y < 330;
    const bubbleY = screenPos ? (diBawah ? screenPos.y + 36 : Math.max(65, screenPos.y - 12)) : 100;
    const status = berjalan ? 'MENGANALISIS' : galat ? 'GAGAL' : 'SELESAI';
    const warna = berjalan ? '#fbbf24' : galat ? '#f87171' : '#34d399';
    const usang = laporan && tanggalSekarang && laporan.per_tanggal !== tanggalSekarang;

    return (
        <div
            style={{
                position: 'absolute',
                left: `${bubbleX}px`,
                top: `${bubbleY}px`,
                transform: diBawah ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                zIndex: 1000,
                width: '420px',
                maxWidth: '92vw',
                maxHeight: '62vh',
                overflowY: 'auto',
                backgroundColor: 'rgba(15, 17, 32, 0.97)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${warna}99`,
                borderRadius: '14px',
                boxShadow: `0 12px 35px ${warna}40, 0 0 0 1px rgba(255,255,255,0.06)`,
                padding: '14px 16px',
                color: '#f8fafc',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: '11px',
                lineHeight: 1.45,
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px' }}>🌐</span>
                <div style={{ flex: 1 }}>
                    <div style={{ color: '#fbbf24', fontSize: '13px', fontWeight: '700' }}>AGENT JARINGAN</div>
                    <div style={{ color: '#64748b', fontSize: '9px' }}>Rexa memeriksa semua toko sekaligus · hanya membaca</div>
                </div>
                <span style={{ fontSize: '10px', padding: '3px 9px', borderRadius: '20px', fontWeight: '700', color: warna, border: `1px solid ${warna}66`, background: `${warna}22` }}>
                    {status}{berjalan ? ` · ${detik} dtk` : ''}
                </span>
                <button onClick={onTutup} title="Tutup (Esc): lanjut berjalan, laporan tetap tersimpan" style={tombol('#cbd5e1')}>{sentuh ? '✕' : '✕ Esc'}</button>
            </div>

            {berjalan && (
                <p style={{ color: '#cbd5e1', margin: '0 0 8px' }}>
                    Membaca statistik semua toko, membuka toko yang paling bermasalah, lalu mencari stok berlebih di toko lain
                    yang bisa menggantikan PO baru. Biasanya 20-40 detik; Anda bisa tetap berjalan.
                </p>
            )}

            {galat && !berjalan && (
                <div style={{ color: '#fca5a5', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
                    ⚠️ {galat}
                </div>
            )}

            {laporan && (
                <div style={{ opacity: berjalan ? 0.5 : 1 }}>
                    {usang && (
                        <div style={{ color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', padding: '6px 10px', marginBottom: '8px' }}>
                            Laporan untuk data {formatIndonesianDate(laporan.per_tanggal)}; tanggal simulasi sudah berubah. Tekan Jalankan Ulang.
                        </div>
                    )}
                    <p style={{ margin: '0 0 10px', color: '#e2e8f0', fontSize: '11.5px' }}>{laporan.ringkasan}</p>

                    {laporan.toko?.length > 0 && (
                        <>
                            <div style={{ color: '#94a3b8', fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '6px' }}>TOKO PRIORITAS</div>
                            {laporan.toko.map((t, i) => (
                                <div key={t.store} style={{ border: '1px solid rgba(148, 163, 184, 0.18)', borderRadius: '8px', padding: '7px 9px', marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                        <strong style={{ color: '#f8fafc' }}>{i + 1}. Toko {t.store} · {t.kota}</strong>
                                        <span style={{ color: statusHealth(t.health_score).warna, fontWeight: '700' }}>{t.health_score}</span>
                                        <button onClick={() => onBukaToko(t.store)} style={{ ...tombol('#38bdf8'), marginLeft: 'auto' }}>Buka toko</button>
                                    </div>
                                    <div style={{ color: '#cbd5e1' }}>{t.alasan}</div>
                                    <div style={{ color: '#34d399', marginTop: '3px' }}>→ {t.tindakan}</div>
                                </div>
                            ))}
                        </>
                    )}

                    {laporan.transfer?.length > 0 && (
                        <>
                            <div style={{ color: '#94a3b8', fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em', margin: '8px 0 6px' }}>TRANSFER YANG DISARANKAN</div>
                            {laporan.transfer.map((t) => (
                                <div key={t.ke_inventory_id} style={{ marginBottom: '5px', color: '#cbd5e1' }}>
                                    🚚 <strong style={{ color: '#f8fafc' }}>{t.deskripsi}</strong>: toko {t.dari_toko} → toko {t.ke_toko},{' '}
                                    {angka(t.qty)} unit · PO dihindari <span style={{ color: '#34d399' }}>{rupiah(t.nilai_idr)}</span>
                                </div>
                            ))}
                        </>
                    )}

                    <div style={{ color: '#64748b', fontSize: '9px', marginTop: '8px' }}>
                        {(laporan.model || '').replace(/^(au|global|apac|us)\./, '')} · {laporan.langkah?.length ?? 0} langkah ·{' '}
                        {angka(laporan.durasi_dtk)} dtk · data {formatIndonesianDate(laporan.per_tanggal)}
                    </div>
                </div>
            )}

            {!laporan && !berjalan && !galat && (
                <p style={{ color: '#94a3b8', margin: 0 }}>Belum ada laporan Agent Jaringan.</p>
            )}

            {!berjalan && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '9px', lineHeight: 1.4 }}>
                        {sentuh ? 'Pergi atau ✕' : 'Pergi, ✕, atau Esc'} untuk menutup. Laporan tetap tersimpan (klik status di header untuk membuka lagi).
                    </span>
                    <button onClick={onJalankanUlang} style={{ ...tombol(warna), padding: '5px 10px' }}>
                        ↻ {laporan || galat ? 'Jalankan Ulang' : 'Jalankan'}
                    </button>
                </div>
            )}
        </div>
    );
}

export default AgentJaringanBubble;
