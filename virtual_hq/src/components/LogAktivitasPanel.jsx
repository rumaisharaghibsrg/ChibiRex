/**
 * LogAktivitasPanel.jsx — Panel petak di pojok kiri atas: semua pesan Doni, Rexa, manajer, dan sistem berurutan
 * (terbaru di bawah), misalnya "DONI (URGENT): Maya: 7 SKU ...", "REXA: Sedang menjalankan analisis Toko 74",
 * "DONI: Sedang menyelesaikan ...". Isinya dari lib/logAktivitas.js. Bisa dikecilkan (di HP kecil sejak awal) dan
 * dikosongkan; posisi gulir tetap di pesan terbaru kecuali pemain sedang membaca pesan lama.
 */

import React, { useEffect, useRef, useState } from 'react';
import { EventBus } from '../game/EventBus';
import { bersihkanLog, isiLog } from '../lib/logAktivitas';
import './LogAktivitasPanel.css';

const NAMA = { doni: 'DONI', rexa: 'REXA', manajer: 'MANAJER', sistem: 'SISTEM' };

export function LogAktivitasPanel({ kecilAwal = false }) {
    const [pesan, setPesan] = useState(isiLog);
    const [kecil, setKecil] = useState(kecilAwal);
    const daftarRef = useRef(null);
    const diBawahRef = useRef(true); // pemain tidak sedang menggulir ke atas

    useEffect(() => {
        const perbarui = (isi) => setPesan([...isi]);
        EventBus.on('log-aktivitas', perbarui);
        return () => EventBus.removeListener('log-aktivitas', perbarui);
    }, []);

    useEffect(() => {
        const el = daftarRef.current;
        if (el && diBawahRef.current) el.scrollTop = el.scrollHeight;
    }, [pesan, kecil]);

    const terakhir = pesan[pesan.length - 1];

    return (
        <div className={`log-aktivitas ${kecil ? 'kecil' : ''}`} aria-label="Log aktivitas">
            <div className="log-aktivitas-kepala">
                <span className="log-aktivitas-judul">📜 LOG AKTIVITAS</span>
                {kecil && terakhir ? (
                    <span className={`log-aktivitas-cuplikan tingkat-${terakhir.tingkat}`}>
                        {NAMA[terakhir.dari]}: {terakhir.teks}
                    </span>
                ) : (
                    <span className="log-aktivitas-jumlah">{pesan.length} pesan</span>
                )}
                {!kecil && pesan.length > 0 && (
                    <button type="button" onClick={bersihkanLog} title="Kosongkan log">🗑</button>
                )}
                <button type="button" onClick={() => setKecil((k) => !k)} title={kecil ? 'Perbesar' : 'Kecilkan'}>
                    {kecil ? '▾' : '▴'}
                </button>
            </div>
            {!kecil && (
                <div
                    ref={daftarRef}
                    className="log-aktivitas-daftar"
                    onScroll={(e) => {
                        const el = e.currentTarget;
                        diBawahRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                    }}
                >
                    {pesan.length === 0 && (
                        <div className="log-aktivitas-kosong">Belum ada aktivitas. Pesan Doni, Rexa, dan sistem muncul di sini.</div>
                    )}
                    {pesan.map((p) => (
                        <div key={p.id} className={`log-aktivitas-baris tingkat-${p.tingkat}`}>
                            <span className="log-aktivitas-pukul">{p.pukul}</span>
                            <span className={`log-aktivitas-dari dari-${p.dari}`}>
                                {NAMA[p.dari] || p.dari}{p.tingkat === 'urgent' ? ' (URGENT)' : ''}:
                            </span>
                            <span className="log-aktivitas-teks">{p.teks}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default LogAktivitasPanel;
