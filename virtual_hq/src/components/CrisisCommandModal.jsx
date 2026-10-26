/**
 * CrisisCommandModal.jsx — Panel Crisis Hub Doni (Koordinator)
 *
 * Doni memantau data toko yang diawasi (pantauKrisis di StoreCrisisState.js) dan hanya melaporkan krisis yang benar-
 * benar ada di data API. Panel ini membaca hasil pemeriksaan yang sama dengan tombol Doni Hub dan sprite Doni, dan
 * ikut diperbarui setiap Doni memeriksa ulang (event 'doni-status'). Panel melayang, bukan modal: pemain tetap bisa
 * bergerak, dan panel tertutup saat pemain pergi, menekan ✕, atau Esc.
 *
 * Semua temuan lintas divisi (Rian, Pak Budi, Maya, Citra) tampil di satu panel dan bisa dipilih. Tombol resolusi
 * menjalankan aksi asli: reset circuit breaker oleh manajer, menugaskan Agent Rexa dengan daftar SKU kritis, membuka
 * Meja Approval untuk draf PO yang sudah disusun, atau membuka laporan staf. Krisis yang sudah ditugaskan berstatus
 * DITANGANI (pending resolution) sampai datanya pulih.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { EventBus } from '../game/EventBus';
import { defaultCrisisState, hasilTerakhir, pantauKrisis, tandaiDitangani } from '../game/StoreCrisisState';
import { useStore } from '../context/StoreContext';
import { useTimeSimulation } from '../context/TimeSimulationContext';
import { api, beritahuDataBerubah } from '../lib/api';
import { angka, rupiahRingkas } from '../lib/format';
import './CrisisCommandModal.css';

const PESAN_SELESAI = {
    'reset-breaker': 'Circuit breaker sudah direset, Manager. PO baru kembali diproses guardrail seperti biasa.',
    agent: 'Agent Rexa sudah saya tugaskan, Manager. Langkahnya tampil di bubble Rexa; saya pantau sampai datanya pulih.',
};

function keteranganPenanganan(k) {
    if (k.agentBekerja) return 'Agent Rexa sedang bekerja untuk toko ini; langkahnya tampil di bubble Rexa.';
    if (k.penanganan?.oleh === 'agent') {
        return `Agent Rexa ditugaskan pukul ${k.penanganan.pukul}` +
            (k.jumlahDraf ? `; ${k.jumlahDraf} draf PO sudah disusun dan menunggu persetujuan Anda.` : '; Doni memantau hasilnya.');
    }
    if (k.penanganan?.oleh === 'manajer') return `Sudah ditinjau manajer pukul ${k.penanganan.pukul}.`;
    if (k.menungguApproval) return `Semua SKU kritis sudah punya draf PO (${k.jumlahDraf}); tinggal persetujuan Anda di Meja Approval.`;
    return '';
}

export function CrisisCommandModal({ isOpen, onClose }) {
    const { currentStore, mode } = useStore();
    const { formattedDate } = useTimeSimulation();
    const storeId = currentStore?.id || 74;
    // Mode Semua Toko: Doni memeriksa seluruh jaringan (hasil disimpan dengan kunci 'jaringan').
    const modeJaringan = mode === 'jaringan';
    const kunci = modeJaringan ? 'jaringan' : storeId;
    const labelData = modeJaringan ? 'semua toko' : `Toko ${storeId}`;
    const [daftarKrisis, setDaftarKrisis] = useState([]);
    const [pilihan, setPilihan] = useState(0);
    const [ringkas, setRingkas] = useState('');
    const [tanggalData, setTanggalData] = useState(null);
    const [memeriksa, setMemeriksa] = useState(false);
    const [galat, setGalat] = useState(null);
    const [isResolving, setIsResolving] = useState(false);
    const [pesanSelesai, setPesanSelesai] = useState(null);

    // Tampilkan hasil pemeriksaan terakhir toko ini (sumber yang sama dengan tombol Doni Hub dan sprite Doni).
    const segarkan = useCallback(() => {
        const hasil = hasilTerakhir(kunci);
        if (!hasil) return false;
        setDaftarKrisis([...hasil.krisis]); // salinan: statusnya diperbarui di tempat oleh pemantauan Doni
        setRingkas(hasil.ringkas);
        setTanggalData(hasil.tanggal);
        setPilihan((i) => (i < hasil.krisis.length ? i : 0));
        return true;
    }, [kunci]);

    const periksa = useCallback(() => {
        setMemeriksa(true);
        setGalat(null);
        return pantauKrisis(kunci)
            .then(segarkan)
            .catch((e) => setGalat(e.message))
            .finally(() => setMemeriksa(false));
    }, [kunci, segarkan]);

    // Saat dibuka (atau toko diganti): tampilkan hasil terakhir; periksa hanya kalau belum ada.
    useEffect(() => {
        if (!isOpen) return;
        setPesanSelesai(null);
        setGalat(null);
        setPilihan(0);
        if (!segarkan()) periksa();
    }, [isOpen, kunci, segarkan, periksa]);

    // Doni memeriksa ulang di latar (data berubah, tiap menit): panel yang terbuka ikut diperbarui.
    useEffect(() => {
        if (!isOpen) return undefined;
        EventBus.on('doni-status', segarkan);
        return () => EventBus.removeListener('doni-status', segarkan);
    }, [isOpen, segarkan]);

    const handleClose = useCallback(() => {
        setIsResolving(false);
        setPesanSelesai(null);
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

    const crisisData = daftarKrisis[pilihan] || defaultCrisisState;

    // Eksekusi resolusi: aksi asli sesuai jenis krisis
    const handleExecuteResolution = async () => {
        const aksi = crisisData.action || {};
        setGalat(null);

        if (aksi.jenis === 'reset-breaker') {
            setIsResolving(true);
            try {
                await api.resetBreaker('Reset dari Crisis Hub Doni (Virtual HQ)');
            } catch (e) {
                setGalat(e.message);
                setIsResolving(false);
                return;
            }
            setIsResolving(false);
            setPesanSelesai(PESAN_SELESAI['reset-breaker']);
            beritahuDataBerubah(); // Doni memeriksa ulang; panel menampilkan kondisi setelah reset
            return;
        }

        if (aksi.jenis === 'agent') {
            // Pending resolution: krisis ini tidak membunyikan alarm lagi selama agent bekerja dan hasilnya ditinjau.
            tandaiDitangani(crisisData, 'agent');
            EventBus.emit('jalankan-agent', modeJaringan ? { jaringan: true } : {
                store: String(aksi.store_id || storeId),
                crisis_type: aksi.crisis_type || crisisData.crisisId,
                sku_ids: aksi.sku_ids || [],
                tugas: aksi.tugas,
            });
            setPesanSelesai(PESAN_SELESAI.agent);
            setTimeout(handleClose, 900); // beri waktu membaca konfirmasi; bubble Rexa terbuka
            return;
        }

        if (aksi.jenis === 'approval') {
            handleClose();
            EventBus.emit('open-approval-modal');
            return;
        }

        if (aksi.jenis === 'npc') {
            tandaiDitangani(crisisData, 'manajer');
            handleClose();
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-npc-dialog-modal', { detail: { npcId: aksi.npcId } }));
            }, 250);
        }
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

    const adaKrisis = daftarKrisis.length > 0;
    const darurat = daftarKrisis.some((k) => k.status === 'BARU');
    const ditanganiIni = crisisData.status === 'DITANGANI';
    const labelAksi = crisisData.action?.jenis === 'agent' && crisisData.penanganan?.oleh === 'agent'
        ? '🤖 Tugaskan Agent Rexa lagi'
        : crisisData.action?.label || '⚡ Tindak lanjuti';

    return (
        <div className="crisis-panel-bebas">
            <div
                className={`crisis-modal-card ${!darurat ? 'normal-mode' : ''}`}
                role="dialog"
                aria-label="Store Crisis Command Hub"
            >
                {/* ── Top Alert Banner ────────────────────────────────────── */}
                <div className="crisis-top-banner">
                    <div className="crisis-banner-title">
                        <span>{darurat ? '🚨' : adaKrisis ? '⏳' : '🛡️'}</span>
                        <span>{`${adaKrisis ? 'CRISIS DISPATCH' : 'STATUS OPERASIONAL'} · ${modeJaringan ? 'SEMUA TOKO' : `TOKO #${storeId}`}`}</span>
                        <span className={darurat ? 'crisis-badge-urgent' : adaKrisis ? 'crisis-badge-ditangani' : 'crisis-badge-normal'}>
                            {memeriksa && !tanggalData ? 'MEMERIKSA' : galat && !tanggalData ? 'OFFLINE'
                                : darurat ? 'URGENT' : adaKrisis ? 'DITANGANI' : 'STABIL'}
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
                                    ● Memantau data tiap menit
                                </span>
                            </div>
                            <p className="crisis-doni-text">
                                {memeriksa && !tanggalData ? (
                                    <>"Sebentar, Manager, saya periksa data {labelData} per {formattedDate}..."</>
                                ) : pesanSelesai ? (
                                    <strong style={{ color: '#4ade80' }}>🎉 "{pesanSelesai}"</strong>
                                ) : galat && !tanggalData ? (
                                    <>"Maaf, Manager, data toko tidak bisa saya baca sekarang: {galat}"</>
                                ) : darurat ? (
                                    <>
                                        "Manager, data {labelData} per {tanggalData} menunjukkan{' '}
                                        <strong>{daftarKrisis.filter((k) => k.status === 'BARU').length} kondisi DARURAT</strong>
                                        {daftarKrisis.length > 1 ? ' dari beberapa divisi' : ''}. Ini angka dari dashboard, bukan perkiraan."
                                    </>
                                ) : adaKrisis ? (
                                    <>"Semua temuan di {labelData} per {tanggalData} sedang ditangani, Manager. Saya pantau sampai datanya pulih."</>
                                ) : (
                                    <>"Tidak ada krisis di {labelData} per {tanggalData}, Manager. {ringkas}"</>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Daftar temuan lintas divisi: pilih untuk melihat rinciannya */}
                    {daftarKrisis.length > 1 && (
                        <div className="crisis-daftar-temuan">
                            {daftarKrisis.map((k, i) => (
                                <button
                                    key={k.crisisId}
                                    onClick={() => { setPilihan(i); setPesanSelesai(null); }}
                                    className={`crisis-temuan ${i === pilihan ? 'aktif' : ''} ${k.status === 'BARU' ? 'baru' : 'ditangani'}`}
                                >
                                    <span>{k.status === 'BARU' ? '🚨' : '⏳'}</span>
                                    <span>{k.sourceName.split(' (')[0]}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Telemetry Card */}
                    {adaKrisis && (
                        <div className="crisis-telemetry-card">
                            <div className="crisis-source-tag">
                                <span>⚠️ SUMBER:</span>
                                <span>{crisisData.sourceName}</span>
                                <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>
                                    ({crisisData.sourceLocation || `Toko ${storeId}`})
                                </span>
                            </div>

                            <h3 className="crisis-problem-headline">{crisisData.headline}</h3>

                            {ditanganiIni && (
                                <div className="crisis-ditangani">⏳ SEDANG DITANGANI · {keteranganPenanganan(crisisData)}</div>
                            )}

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

                            {/* SKU kritis (sumber sama dengan laporan Maya): stok, saran PO, dan status draf */}
                            {crisisData.sku_list?.length > 0 && (
                                <div className="crisis-sku-wrapper">
                                    <table className="crisis-sku-table">
                                        <thead>
                                            <tr><th>SKU</th><th>Stok / ROP</th><th>Saran PO</th><th>Draf PO</th></tr>
                                        </thead>
                                        <tbody>
                                            {crisisData.sku_list.map((x) => (
                                                <tr key={x.inventory_id}>
                                                    <td title={x.inventory_id}>{x.deskripsi || x.inventory_id}</td>
                                                    <td>{angka(x.stok_akhir)} / {angka(x.reorder_point)}</td>
                                                    <td>{angka(x.saran_qty_po)} · {rupiahRingkas(x.nilai_saran_po_idr)}</td>
                                                    <td className={x.adaDraf ? 'ada' : 'belum'}>{x.adaDraf ? '✓ menunggu' : 'belum'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
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
                    {adaKrisis ? (
                        <>
                            <button
                                onClick={handleExecuteResolution}
                                disabled={isResolving || Boolean(pesanSelesai)}
                                className="crisis-btn-resolve"
                            >
                                {isResolving ? (
                                    <>
                                        <span className="status-dot pulse-amber" />
                                        <span>{crisisData.action?.jenis === 'reset-breaker' ? 'MERESET BREAKER...' : 'MENUGASKAN AGENT...'}</span>
                                    </>
                                ) : pesanSelesai ? (
                                    <span>{crisisData.action?.jenis === 'reset-breaker' ? '✔️ CIRCUIT BREAKER DIRESET' : '✔️ AGENT REXA DITUGASKAN'}</span>
                                ) : (
                                    <span>{labelAksi}</span>
                                )}
                            </button>

                            <div className="crisis-btn-row">
                                {crisisData.action?.jenis === 'agent' && crisisData.jumlahDraf > 0 && (
                                    <button
                                        onClick={() => { handleClose(); EventBus.emit('open-approval-modal'); }}
                                        className="crisis-btn-secondary"
                                        title="Draf PO yang sudah disusun agent menunggu persetujuan manajer"
                                    >
                                        <span>📝 Meja Approval ({crisisData.jumlahDraf})</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleContactSourceViaIntercom}
                                    className="crisis-btn-secondary"
                                    title="Hubungi divisi sumber krisis via Smartphone Intercom"
                                >
                                    <span>📞</span>
                                    <span>Hubungi Sumber</span>
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
