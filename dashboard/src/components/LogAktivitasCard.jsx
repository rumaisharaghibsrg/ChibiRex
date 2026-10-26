import React, { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { api } from '../lib/api';
import { rupiahRingkas } from '../lib/format';

// Log Aktivitas ringkas di Dashboard Utama: satu baris per kejadian dari audit log API ("17.14 Agent berjalan",
// "17.15 Agent berhasil"). Sumbernya API, jadi aksi dari Virtual HQ, Doni, atau perangkat lain juga tampil.
const INTERVAL_MS = 5000;
const JAM = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

const tokoDari = (d) => d.store ?? (d.inventory_id ? d.inventory_id.split('_')[0] : null);

// [teks, nada] untuk satu entri audit. nada: jalan (kuning), ok (hijau), gagal (merah), info (abu-abu).
function baris(a) {
  const d = a.detail || {};
  const t = tokoDari(d) ? ` · Toko ${tokoDari(d)}` : '';
  switch (a.aksi) {
    case 'agent_mulai': return [`Agent berjalan${t}`, 'jalan'];
    case 'agent_selesai': return [`Agent berhasil${t} · ${d.langkah ?? 0} langkah`, 'ok'];
    case 'agent_gagal': return [`Agent gagal${t}`, 'gagal'];
    case 'draft_purchase_order':
      return d.status === 'DRAFT'
        ? [`Draf PO disusun${t} · ${rupiahRingkas(d.nilai_idr)}`, 'info']
        : [`PO ditahan guardrail${t}${d.pelanggaran?.length ? ` · ${d.pelanggaran.join(', ')}` : ''}`, 'gagal'];
    case 'po_approved': return [`PO disetujui${d.sap_po_number ? ` · SAP ${d.sap_po_number}` : ''}`, 'ok'];
    case 'po_rejected': return ['PO ditolak', 'info'];
    case 'hold_reorder': return [`Reorder ditahan${t} · modal diselamatkan ${rupiahRingkas(d.modal_diselamatkan_idr)}`, 'ok'];
    case 'hold_reorder_ditolak': return [`Hold ditolak guardrail${t}`, 'gagal'];
    case 'circuit_breaker_terbuka': return ['Circuit breaker terbuka', 'gagal'];
    case 'circuit_breaker_reset': return ['Circuit breaker direset', 'ok'];
    case 'simulasi_maju': return [`Tanggal simulasi maju ${d.hari} hari`, 'info'];
    case 'simulasi_mundur': return [`Tanggal simulasi mundur ${d.hari} hari`, 'info'];
    case 'simulasi_kembali': return ['Tanggal simulasi kembali ke 31 Des 2016', 'info'];
    case 'simulasi_otomatis': return [d.aktif ? 'Simulasi otomatis berjalan' : 'Simulasi otomatis dijeda', 'info'];
    case 'reset_demo': return ['Data demo direset', 'info'];
    case 'catat_stok_fisik': return [`Hitung fisik dicatat${t}`, 'info'];
    case 'audit_stok_selesai': return [`Audit stok selesai${t}`, 'ok'];
    default: return [a.aksi.replace(/_/g, ' '), 'info'];
  }
}

const WARNA = {
  jalan: 'bg-amber-400 animate-pulse',
  jalanSelesai: 'bg-amber-300', // "Agent berjalan" yang run-nya sudah selesai: tidak berkedip lagi
  ok: 'bg-emerald-500',
  gagal: 'bg-red-500',
  info: 'bg-slate-300',
};

export default function LogAktivitasCard({ refreshKey }) {
  const [log, setLog] = useState(null);
  const [galat, setGalat] = useState(null);
  const daftarRef = useRef(null);

  useEffect(() => {
    let aktif = true;
    const muat = () => api.auditLog(40)
      .then((d) => { if (aktif) { setLog([...d].reverse()); setGalat(null); } }) // terlama di atas, seperti log
      .catch((e) => { if (aktif) setGalat(e.message); });
    muat();
    const ulang = setInterval(muat, INTERVAL_MS);
    return () => {
      aktif = false;
      clearInterval(ulang);
    };
  }, [refreshKey]);

  // Pesan terbaru di bawah dan langsung terlihat.
  useEffect(() => {
    const el = daftarRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const selesai = new Set((log || [])
    .filter((a) => a.aksi === 'agent_selesai' || a.aksi === 'agent_gagal').map((a) => a.resource_id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-slate-700" />
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">Log Aktivitas</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Semua toko · diperbarui tiap 5 detik</p>
        </div>
      </div>
      <div ref={daftarRef} className="max-h-72 overflow-y-auto px-6 py-3 font-mono text-xs">
        {galat && !log && <p className="text-red-600">Log belum bisa dibaca: {galat}</p>}
        {!galat && !log && <p className="text-slate-400">Memuat...</p>}
        {log && log.length === 0 && <p className="text-slate-400">Belum ada aktivitas.</p>}
        {log?.map((a) => {
          const [teks, nadaAsli] = baris(a);
          const nada = nadaAsli === 'jalan' && selesai.has(a.resource_id) ? 'jalanSelesai' : nadaAsli;
          return (
            <div key={a.id ?? `${a.waktu}-${a.aksi}-${a.resource_id}`} className="flex items-start gap-2.5 py-1">
              <span className="text-slate-400 tabular-nums shrink-0">{JAM.format(new Date(a.waktu))}</span>
              <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${WARNA[nada]}`} />
              <span className={nada === 'gagal' ? 'text-red-700' : 'text-slate-700'}>{teks}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
