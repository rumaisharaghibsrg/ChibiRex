import React, { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { rupiahRingkas } from '../lib/format';

// Log Aktivitas dashboard: bubble melayang di pojok kiri atas (seperti di Virtual HQ) yang bisa dikecilkan menjadi pil
// berisi pesan terbaru dan dibuka lagi. Satu baris per kejadian dari audit log API ("17.14 Agent berjalan",
// "17.15 Agent berhasil"), jadi aksi dari Virtual HQ, Doni, atau perangkat lain juga tampil.
const INTERVAL_MS = 5000;
const KUNCI_TERBUKA = 'rexa.dashboardLog.terbuka';
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

// Terbuka atau kecil disimpan di browser ini; awalnya terbuka di layar lebar, kecil di HP.
function bacaTerbuka() {
  try {
    const simpan = localStorage.getItem(KUNCI_TERBUKA);
    if (simpan !== null) return simpan === '1';
  } catch {
    // localStorage tidak tersedia: pakai bawaan
  }
  return typeof window !== 'undefined' && window.innerWidth >= 1024;
}

export default function LogAktivitasBubble({ refreshKey }) {
  const [log, setLog] = useState(null);
  const [galat, setGalat] = useState(null);
  const [terbuka, setTerbuka] = useState(bacaTerbuka);
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
  }, [log, terbuka]);

  const ubah = () => setTerbuka((t) => {
    try {
      localStorage.setItem(KUNCI_TERBUKA, t ? '0' : '1');
    } catch {
      // abaikan: pilihan hanya berlaku selama halaman terbuka
    }
    return !t;
  });

  const selesai = new Set((log || [])
    .filter((a) => a.aksi === 'agent_selesai' || a.aksi === 'agent_gagal').map((a) => a.resource_id));
  const nadaDari = (a) => {
    const [, nada] = baris(a);
    return nada === 'jalan' && selesai.has(a.resource_id) ? 'jalanSelesai' : nada;
  };
  const terakhir = log?.[log.length - 1];

  return (
    // Layar lebar: kiri atas, di kanan sidebar dan di bawah header. HP: kiri bawah, pil ringkas di sebelah kiri tombol
    // Copilot; saat dibuka, panelnya naik di atas tombol itu.
    <div className={`fixed z-40 left-3 lg:left-[272px] lg:top-28 lg:bottom-auto lg:w-[400px] ${
      terbuka ? 'bottom-20 w-[calc(100vw-1.5rem)]' : 'bottom-4 w-auto'}`}>
      {!terbuka ? (
        <button
          type="button"
          onClick={ubah}
          className="w-full flex items-center gap-2.5 bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-lg px-4 py-2 text-left hover:border-slate-300 transition-colors"
          title="Buka Log Aktivitas"
        >
          <Activity className="w-4 h-4 text-slate-700 shrink-0" />
          <span className="text-xs font-extrabold text-slate-900 shrink-0 lg:hidden">Log</span>
          <span className="text-xs font-extrabold text-slate-900 shrink-0 hidden lg:inline">Log Aktivitas</span>
          {terakhir && (
            <>
              <span className={`w-2 h-2 rounded-full shrink-0 ${WARNA[nadaDari(terakhir)]}`} />
              <span className="text-xs text-slate-600 font-mono truncate hidden lg:inline">
                {JAM.format(new Date(terakhir.waktu))} {baris(terakhir)[0]}
              </span>
            </>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-auto" />
        </button>
      ) : (
        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200/80 flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-slate-700 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 leading-tight">Log Aktivitas</h3>
              <p className="text-[11px] text-slate-500 font-medium">Semua toko · diperbarui tiap 5 detik</p>
            </div>
            <button
              type="button"
              onClick={ubah}
              className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
              title="Kecilkan"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
          <div ref={daftarRef} className="max-h-[40vh] overflow-y-auto px-4 py-2 font-mono text-xs">
            {galat && !log && <p className="text-red-600 py-1">Log belum bisa dibaca: {galat}</p>}
            {!galat && !log && <p className="text-slate-400 py-1">Memuat...</p>}
            {log && log.length === 0 && <p className="text-slate-400 py-1">Belum ada aktivitas.</p>}
            {log?.map((a) => {
              const [teks] = baris(a);
              const nada = nadaDari(a);
              return (
                <div key={a.id} className="flex items-start gap-2.5 py-1">
                  <span className="text-slate-400 tabular-nums shrink-0">{JAM.format(new Date(a.waktu))}</span>
                  <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${WARNA[nada]}`} />
                  <span className={nada === 'gagal' ? 'text-red-700' : 'text-slate-700'}>{teks}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
