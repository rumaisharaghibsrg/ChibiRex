/**
 * ApprovalModal.jsx — Meja Manajer: 1-Click PO Approval ke SAP S/4HANA
 *
 * Komponen Modal React untuk:
 *  - Mengambil draf PO toko yang diawasi via GET /purchase-orders?store=&status=DRAFT
 *  - Metrik agregat (Total Draf, Estimasi Nilai IDR)
 *  - Eksekusi 1-Click Approval via POST /purchase-orders/{po_id}/approve ke SAP (tiruan OData di API)
 *  - Eksekusi Penolakan via POST /purchase-orders/{po_id}/reject
 *  - Pratinjau payload OData V2 SAP S/4HANA
 *  - Efek Confetti saat PO sukses terbit di SAP
 * Kalau API menolak atau tidak terjangkau, pesan galatnya ditampilkan; tidak ada PO atau nomor SAP pengganti.
 */

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { SentenceWithDot } from './NPCDialogModal';
import { api, beritahuDataBerubah } from '../lib/api';

function formatRupiah(num) {
    if (num === null || num === undefined) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(num);
}

export function ApprovalModal({ isOpen, store, onClose }) {
    const [draftList, setDraftList]         = useState([]);
    const [loading, setLoading]             = useState(false);
    const [approvingId, setApprovingId]     = useState(null);
    const [rejectingId, setRejectingId]     = useState(null);
    const [previewPayload, setPreviewPayload] = useState(null);
    const [loadingPayloadId, setLoadingPayloadId] = useState(null);
    const [toastMessage, setToastMessage]   = useState(null);
    const [errorMessage, setErrorMessage]   = useState(null);

    // ── Ambil Draf PO Toko yang Diawasi ──────────────────────────────────────
    const fetchDraftOrders = useCallback(async () => {
        setLoading(true);
        setErrorMessage(null);
        try {
            setDraftList(await api.daftarPo({ store, status: 'DRAFT' }));
        } catch (err) {
            setDraftList([]);
            setErrorMessage(`Draf PO tidak bisa dibaca: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [store]);

    useEffect(() => {
        if (isOpen) {
            fetchDraftOrders();
            setToastMessage(null);
            setPreviewPayload(null);
        }
    }, [isOpen, fetchDraftOrders]);

    // ── Handle Tombol Escape & Universal E Toggle untuk Menutup Modal ─────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isInputTarget = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable);
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'e') && isOpen && !isInputTarget) {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const hapusDariDaftar = (poId, jedaTutup) => {
        const remaining = draftList.filter((item) => item.po_id !== poId);
        setDraftList(remaining);
        if (remaining.length === 0) {
            setTimeout(() => onClose(), jedaTutup);
        }
    };

    // ── Eksekusi Approval PO ke SAP S/4HANA ────────────────────────────────────
    const handleApprove = async (poId) => {
        setApprovingId(poId);
        setErrorMessage(null);
        try {
            const approvedPO = await api.setujuiPo(poId, '1-Click Approval dari Meja Manajer Virtual HQ');

            // Efek Confetti Perayaan Visual
            confetti({
                particleCount: 85,
                spread: 75,
                origin: { y: 0.6 },
                colors: ['#34d399', '#38bdf8', '#fbbf24', '#a78bfa'],
            });
            setToastMessage({ poId, sapNumber: approvedPO.sap_po_number, deskripsi: approvedPO.deskripsi });
            beritahuDataBerubah();
            hapusDariDaftar(poId, 2000);
        } catch (err) {
            // Misalnya ditahan guardrail atau SAP menolak: PO tetap DRAFT dan alasannya ditampilkan.
            setErrorMessage(`PO ${poId} belum disetujui: ${err.message}`);
        } finally {
            setApprovingId(null);
        }
    };

    // ── Eksekusi Penolakan PO ─────────────────────────────────────────────────
    const handleReject = async (poId) => {
        setRejectingId(poId);
        setErrorMessage(null);
        try {
            await api.tolakPo(poId, 'Ditolak dari Meja Manajer Virtual HQ');
            beritahuDataBerubah();
            hapusDariDaftar(poId, 1200);
        } catch (err) {
            setErrorMessage(`PO ${poId} belum ditolak: ${err.message}`);
        } finally {
            setRejectingId(null);
        }
    };

    // ── Ambil Pratinjau Payload OData SAP ─────────────────────────────────────
    const handleTogglePayloadPreview = async (poId) => {
        if (previewPayload && previewPayload.po_id === poId) {
            setPreviewPayload(null);
            return;
        }

        setLoadingPayloadId(poId);
        try {
            setPreviewPayload(await api.payloadSap(poId));
        } catch (err) {
            setErrorMessage(`Payload SAP tidak bisa dibaca: ${err.message}`);
        } finally {
            setLoadingPayloadId(null);
        }
    };

    if (!isOpen) return null;

    const totalNilaiIdr = draftList.reduce((acc, po) => acc + (po.nilai_idr || 0), 0);

    return (
        <div
            className="approval-modal-overlay"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2000,
                backgroundColor: 'rgba(5, 7, 18, 0.86)',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                animation: 'fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
        >
            <div
                className="approval-modal-card"
                style={{
                    backgroundColor: '#111425',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '16px',
                    width: '740px',
                    maxWidth: '96vw',
                    maxHeight: '88vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 189, 248, 0.15)',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    color: '#f8fafc',
                    overflow: 'hidden',
                }}
            >
                {/* ── Modal Header & Summary KPI Bar ──────────────────────── */}
                <div
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#161a30',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                }}
                            >
                                📋
                            </div>
                            <div>
                                <div style={{ color: '#38bdf8', fontSize: '15px', fontWeight: '700' }}>
                                    Meja Manajer — 1-Click PO Approval ke SAP S/4HANA
                                </div>
                                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '1px' }}>
                                    <SentenceWithDot text={`Draf PO Toko ${store} dari Agent Rexa; tidak ada yang masuk SAP sebelum disetujui`} />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            title="Tutup (Esc)"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: '#94a3b8',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Metrik Agregat Draf */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>Menunggu Persetujuan:</span>
                            <span style={{ color: '#fbbf24', fontWeight: '700', fontSize: '13px' }}>
                                {draftList.length} Draf PO
                            </span>
                        </div>

                        <div
                            style={{
                                flex: 1.2,
                                padding: '8px 12px',
                                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
                            <span style={{ color: '#94a3b8', fontSize: '11px' }}>Total Estimasi Nilai:</span>
                            <span style={{ color: '#34d399', fontWeight: '700', fontSize: '13px' }}>
                                {formatRupiah(totalNilaiIdr)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Toast Sukses (SAP PO Number) ────────────────────────── */}
                {toastMessage && (
                    <div
                        style={{
                            backgroundColor: 'rgba(52, 211, 153, 0.15)',
                            borderBottom: '1px solid rgba(52, 211, 153, 0.4)',
                            padding: '12px 20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: '#34d399',
                            fontSize: '12px',
                            fontWeight: '600',
                            animation: 'slide-down 0.25s ease-out',
                        }}
                    >
                        <span style={{ fontSize: '18px' }}>🎉</span>
                        <div>
                            PO <strong>{toastMessage.poId}</strong> ({toastMessage.deskripsi}) berhasil diterbitkan ke SAP S/4HANA!
                            <div style={{ color: '#f8fafc', fontSize: '11px', marginTop: '2px' }}>
                                Nomor Dokumen SAP: <strong style={{ color: '#38bdf8', textDecoration: 'underline' }}>{toastMessage.sapNumber}</strong>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Error Banner ────────────────────────────────────────── */}
                {errorMessage && (
                    <div
                        style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
                            padding: '10px 20px',
                            color: '#f87171',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <span>⚠️</span>
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* ── Modal Body / PO List ─────────────────────────────────── */}
                <div
                    style={{
                        padding: '16px 20px',
                        overflowY: 'auto',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}
                >
                    {loading && (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                            <div
                                style={{
                                    display: 'inline-block',
                                    width: '26px',
                                    height: '26px',
                                    border: '3px solid rgba(56, 189, 248, 0.2)',
                                    borderTop: '3px solid #38bdf8',
                                    borderRadius: '50%',
                                    animation: 'spin 0.7s linear infinite',
                                    marginBottom: '12px',
                                }}
                            />
                            <div>Memuat draf PO tervalidasi guardrail...</div>
                        </div>
                    )}

                    {!loading && draftList.length === 0 && (
                        <div
                            style={{
                                textAlign: 'center',
                                padding: '45px 20px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: '12px',
                                border: '1px dashed rgba(56, 189, 248, 0.25)',
                            }}
                        >
                            <span style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}>✨</span>
                            <div style={{ color: '#34d399', fontSize: '15px', fontWeight: '700' }}>
                                Semua Draf PO Telah Selesai Diproses!
                            </div>
                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '6px', maxWidth: '380px', margin: '6px auto 16px' }}>
                                Tidak ada dokumen pesanan yang menunggu approval. Rekomendasi baru akan muncul saat agen Rexa menganalisis toko.
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    backgroundColor: '#38bdf8',
                                    color: '#090a12',
                                    border: 'none',
                                    padding: '8px 22px',
                                    borderRadius: '8px',
                                    fontWeight: '700',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(56, 189, 248, 0.35)',
                                }}
                            >
                                Kembali ke Kantor Virtual
                            </button>
                        </div>
                    )}

                    {!loading &&
                        draftList.map((po) => {
                            const isThisApproving = approvingId === po.po_id;
                            const isThisRejecting = rejectingId === po.po_id;
                            const isPreviewOpen   = previewPayload?.po_id === po.po_id;

                            return (
                                <div
                                    key={po.po_id}
                                    style={{
                                        backgroundColor: '#16192c',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        transition: 'border-color 0.2s ease',
                                    }}
                                >
                                    {/* Baris Atas: Badge Status, ID & Vendor */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span
                                                style={{
                                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                    color: '#fbbf24',
                                                    border: '1px solid rgba(245, 158, 11, 0.4)',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700',
                                                }}
                                            >
                                                {po.status}
                                            </span>
                                            <strong style={{ color: '#38bdf8', fontSize: '13px' }}>
                                                {po.po_id}
                                            </strong>
                                            <span style={{ color: '#64748b', fontSize: '11px' }}>
                                                Cabang #{po.store}
                                            </span>
                                        </div>

                                        {po.vendor_name && (
                                            <div style={{ color: '#94a3b8', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span>🏢</span>
                                                <span>{po.vendor_name} (#{po.vendor_number})</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Baris Tengah: Deskripsi SKU & Angka Nilai */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: '220px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                                                {po.deskripsi || po.inventory_id}
                                            </div>
                                            <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>
                                                SKU ID: {po.inventory_id}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', textAlign: 'right' }}>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>Jumlah Pesanan</div>
                                                <div style={{ color: '#f8fafc', fontWeight: '700', fontSize: '14px' }}>
                                                    {po.qty} <span style={{ fontSize: '11px', color: '#94a3b8' }}>unit</span>
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '10px' }}>Total Tagihan (IDR)</div>
                                                <div style={{ color: '#34d399', fontWeight: '700', fontSize: '15px' }}>
                                                    {formatRupiah(po.nilai_idr)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Kutipan Alasan Rekomendasi Agen */}
                                    {po.alasan && (
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                color: '#94a3b8',
                                                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                                                padding: '8px 10px',
                                                borderRadius: '6px',
                                                borderLeft: '3px solid #38bdf8',
                                                lineHeight: '1.4',
                                            }}
                                        >
                                            <span style={{ color: '#38bdf8', marginRight: '4px' }}>💡 Alasan Agen Rexa:</span>
                                            {po.alasan}
                                        </div>
                                    )}

                                    {/* Baris Bawah: Tombol Pratinjau Payload & Tombol Tindakan */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button
                                            onClick={() => handleTogglePayloadPreview(po.po_id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#38bdf8',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 0',
                                            }}
                                        >
                                            <span>{isPreviewOpen ? '▼ Sembunyikan' : '▶ Pratinjau'} Payload SAP</span>
                                            {loadingPayloadId === po.po_id && <span>(memuat...)</span>}
                                        </button>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => handleReject(po.po_id)}
                                                disabled={isThisApproving || isThisRejecting}
                                                style={{
                                                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                                    color: '#f87171',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    padding: '7px 14px',
                                                    borderRadius: '6px',
                                                    fontWeight: '600',
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    fontSize: '11px',
                                                    cursor: (isThisApproving || isThisRejecting) ? 'not-allowed' : 'pointer',
                                                }}
                                            >
                                                {isThisRejecting ? 'Menolak...' : 'Tolak'}
                                            </button>

                                            <button
                                                onClick={() => handleApprove(po.po_id)}
                                                disabled={isThisApproving || isThisRejecting}
                                                style={{
                                                    backgroundColor: isThisApproving ? '#475569' : '#10b981',
                                                    color: '#ffffff',
                                                    border: 'none',
                                                    padding: '8px 18px',
                                                    borderRadius: '6px',
                                                    fontWeight: '700',
                                                    fontFamily: "'JetBrains Mono', monospace",
                                                    fontSize: '12px',
                                                    cursor: (isThisApproving || isThisRejecting) ? 'not-allowed' : 'pointer',
                                                    boxShadow: isThisApproving ? 'none' : '0 4px 15px rgba(16, 185, 129, 0.4)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                {isThisApproving ? (
                                                    <>
                                                        <span
                                                            style={{
                                                                width: '10px',
                                                                height: '10px',
                                                                border: '2px solid #fff',
                                                                borderTop: '2px solid transparent',
                                                                borderRadius: '50%',
                                                                animation: 'spin 0.6s linear infinite',
                                                            }}
                                                        />
                                                        <span>Kirim ke SAP...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>⚡</span>
                                                        <span>1-Click Approve (SAP)</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pratinjau Drawer JSON OData SAP */}
                                    {isPreviewOpen && previewPayload && (
                                        <div
                                            style={{
                                                backgroundColor: '#090b14',
                                                padding: '10px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                                fontSize: '10px',
                                                color: '#cbd5e1',
                                                marginTop: '6px',
                                            }}
                                        >
                                            <div style={{ color: '#38bdf8', marginBottom: '4px', fontWeight: '700' }}>
                                                Tujuan: {previewPayload.tujuan}
                                            </div>
                                            <pre style={{ margin: 0, maxHeight: '120px', overflowY: 'auto' }}>
                                                {JSON.stringify(previewPayload.payload, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>

                {/* ── Modal Footer ────────────────────────────────────────── */}
                <div
                    style={{
                        padding: '12px 20px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: '#0f1222',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: '#64748b',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                        <span>Koneksi ERP: <strong style={{ color: '#38bdf8' }}>SAP S/4HANA OData V2</strong></span>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8',
                            padding: '4px 14px',
                            borderRadius: '6px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '11px',
                            cursor: 'pointer',
                        }}
                    >
                        Tutup [Esc]
                    </button>
                </div>
            </div>

            <style>
                {`
                    @keyframes fade-in {
                        from { opacity: 0; transform: scale(0.97); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    @keyframes slide-down {
                        from { transform: translateY(-8px); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `}
            </style>
        </div>
    );
}
