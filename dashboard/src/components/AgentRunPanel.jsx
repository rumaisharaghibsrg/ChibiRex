import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Play,
  ListChecks,
  Brain,
  Zap,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Send,
  Laptop
} from 'lucide-react';
import { api } from '../lib/api';
import { rupiah } from '../lib/format';

// Pengelompokan tool agent ke loop agentic yang diminta juri: plan -> reason -> act -> review.
const FASE = [
  { id: 'PLAN', label: 'Plan', icon: ListChecks, desc: 'Ambil daftar prioritas toko' },
  { id: 'REASON', label: 'Reason', icon: Brain, desc: 'Cek substitusi & metrik' },
  { id: 'ACT', label: 'Act', icon: Zap, desc: 'Hold, draf PO, realokasi' },
  { id: 'REVIEW', label: 'Review', icon: ShieldCheck, desc: 'Guardrail & approval manajer' },
];
const FASE_TOOL = {
  list_prioritas: 'PLAN',
  get_sku_metrics: 'REASON',
  check_substitution: 'REASON',
  hold_reorder: 'ACT',
  draft_purchase_order: 'ACT',
  suggest_reallocation: 'ACT',
};
const NAMA_TOOL = {
  list_prioritas: 'Ambil daftar prioritas toko',
  get_sku_metrics: 'Baca metrik SKU',
  check_substitution: 'Cek peran komplementer (Market Basket)',
  hold_reorder: 'Tahan reorder (Hold Reorder)',
  draft_purchase_order: 'Susun draf PO',
  suggest_reallocation: 'Saran realokasi modal',
};
const INTERVAL_PANTAU_MS = 1500;
const INTERVAL_WORKER_MS = 15000;
const TANPA_LANGKAH = [];
// MENUNGGU: mode antrian (API di Lambda), tugas belum diambil worker agent di laptop.
const STATUS_AKTIF = ['MENUNGGU', 'BERJALAN'];

// Keterangan cara agent dijalankan, dari GET /agent-runs/worker.
function KeteranganWorker({ worker }) {
  if (!worker || worker.mode === 'lokal') return null;
  if (worker.mode === 'mati') {
    return <span className="text-amber-700">Agent belum tersedia di versi online.</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 ${worker.aktif ? 'text-emerald-700' : 'text-amber-700'}`}>
      <Laptop className="w-3.5 h-3.5" />
      LLM di laptop: worker {worker.aktif ? 'aktif' : 'tidak aktif (jalankan python -m agent.worker)'}
    </span>
  );
}

function diblokir(output) {
  return Boolean(output?.ditolak || output?.error || output?.status === 'DITAHAN_GUARDRAIL');
}

function hasilLangkah(langkah) {
  const out = langkah.output || {};
  if (out.error) return { teks: out.error, buruk: true };
  if (out.ditolak) return { teks: `Diblokir guardrail: ${out.kode}${out.pesan ? ` (${out.pesan})` : ''}`, buruk: true };
  switch (langkah.tool) {
    case 'list_prioritas':
      return { teks: `${out.naik?.length ?? 0} SKU penjualan naik, ${out.turun?.length ?? 0} SKU penjualan turun` };
    case 'check_substitution':
      return { teks: `${out.jenis ?? '-'}: ${out.status}` };
    case 'hold_reorder':
      return { teks: `Hold aktif, modal diselamatkan ${rupiah(out.modal_diselamatkan_idr)}` };
    case 'draft_purchase_order':
      if (out.status === 'DITAHAN_GUARDRAIL') {
        return { teks: `Ditahan guardrail: ${(out.pelanggaran || []).join(', ')}`, buruk: true };
      }
      return { teks: `Draf ${out.po_id}: ${out.qty} unit, ${rupiah(out.nilai_idr)} (menunggu manajer)`, poId: out.po_id };
    case 'suggest_reallocation':
      return { teks: out.pesan };
    case 'get_sku_metrics':
      return { teks: `${out.status_stok ?? ''} ${out.arah_tren ? `, tren ${out.arah_tren}` : ''}` };
    default:
      return { teks: '' };
  }
}

// Ringkasan agent berisi markdown sederhana (**tebal** dan baris baru).
function TeksAgent({ teks }) {
  return teks.split('\n').map((baris, i) => (
    <p key={i} className={baris.trim() ? 'leading-relaxed' : 'h-2'}>
      {baris.split(/(\*\*[^*]+\*\*)/).map((bagian, j) =>
        bagian.startsWith('**') && bagian.endsWith('**')
          ? <strong key={j} className="text-slate-900">{bagian.slice(2, -2)}</strong>
          : <span key={j}>{bagian}</span>
      )}
    </p>
  ));
}

export default function AgentRunPanel({ store, onSelesai, onBukaPo }) {
  const [run, setRun] = useState(null);
  const [galat, setGalat] = useState(null);
  const [memulai, setMemulai] = useState(false);
  const [detik, setDetik] = useState(0);

  const mulaiRef = useRef(0);
  const onSelesaiRef = useRef(onSelesai);
  useEffect(() => {
    onSelesaiRef.current = onSelesai;
  });

  // Tampilkan run terakhir toko ini saat panel dibuka, supaya jejak agent tidak hilang kalau halaman di-refresh.
  useEffect(() => {
    let aktif = true;
    api.riwayatAgent(20)
      .then((daftar) => {
        const terakhir = daftar.find((r) => r.store === store);
        if (aktif && terakhir) {
          setRun((r) => r ?? { ...terakhir, status: terakhir.berhasil ? 'SELESAI' : 'GAGAL' });
        }
      })
      .catch(() => {}); // panel tetap bisa dipakai; galat API muncul saat agent dijalankan
    return () => {
      aktif = false;
    };
  }, [store]);

  const [worker, setWorker] = useState(null);
  useEffect(() => {
    const muat = () => api.statusWorker().then(setWorker).catch(() => {});
    muat();
    const ulang = setInterval(muat, INTERVAL_WORKER_MS);
    return () => clearInterval(ulang);
  }, []);

  const berjalan = STATUS_AKTIF.includes(run?.status);
  const menunggu = run?.status === 'MENUNGGU';
  const runId = run?.run_id;

  // Pantau langkah agent selagi berjalan; berhenti saat SELESAI atau GAGAL.
  useEffect(() => {
    if (!berjalan) return undefined;
    const pantau = setInterval(async () => {
      setDetik(Math.round((Date.now() - mulaiRef.current) / 1000));
      try {
        const terbaru = await api.statusAgent(runId);
        setRun(terbaru);
        if (!STATUS_AKTIF.includes(terbaru.status)) onSelesaiRef.current?.(terbaru);
      } catch (e) {
        setGalat(e.message);
      }
    }, INTERVAL_PANTAU_MS);
    return () => clearInterval(pantau);
  }, [berjalan, runId]);

  const jalankan = async () => {
    mulaiRef.current = Date.now();
    setMemulai(true);
    setGalat(null);
    setDetik(0);
    try {
      setRun(await api.mulaiAgent(store));
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMemulai(false);
    }
  };

  const langkah = run?.langkah ?? TANPA_LANGKAH;
  // Nama produk diambil dari hasil list_prioritas, karena hasil tool lain hanya berisi inventory_id.
  const namaSku = useMemo(() => {
    const prioritas = langkah.find((l) => l.tool === 'list_prioritas')?.output || {};
    return Object.fromEntries([...(prioritas.naik || []), ...(prioritas.turun || [])]
      .map((s) => [s.inventory_id, s.deskripsi]));
  }, [langkah]);

  const faseTercapai = new Set(langkah.map((l) => FASE_TOOL[l.tool]));
  if (run && !berjalan) faseTercapai.add('REVIEW');
  const jumlahDiblokir = langkah.filter((l) => diblokir(l.output)).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1b4d3e] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-[#a2d2bf]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">Agent Rexa</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Toko {store} &bull; semua aksi lewat API berguardrail, PO tetap menunggu persetujuan manajer
            </p>
            <p className="text-[11px] font-semibold mt-0.5">
              <KeteranganWorker worker={worker} />
            </p>
          </div>
        </div>
        <button
          onClick={jalankan}
          disabled={berjalan || memulai}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-[#1b4d3e] hover:bg-[#143d31] disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-sm transition-all active:scale-95 whitespace-nowrap"
        >
          {berjalan || memulai ? (
            <>
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              <span>{menunggu ? 'Menunggu worker' : 'Agent berjalan'}{berjalan ? ` (${detik} dtk)` : '...'}</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-[#a2d2bf]" />
              <span>{run ? 'Jalankan Lagi' : 'Jalankan Agent'}</span>
            </>
          )}
        </button>
      </div>

      {/* Loop agentic */}
      <div className="px-6 pt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
        {FASE.map((f) => {
          const aktif = faseTercapai.has(f.id);
          const Icon = f.icon;
          return (
            <div
              key={f.id}
              className={`p-3 rounded-xl border transition-colors ${aktif ? 'bg-[#eaf4ef] border-[#a2d2bf]' : 'bg-slate-50 border-slate-200'}`}
            >
              <div className={`flex items-center gap-1.5 text-xs font-extrabold ${aktif ? 'text-[#1b4d3e]' : 'text-slate-400'}`}>
                <Icon className="w-3.5 h-3.5" />
                {f.label}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{f.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Langkah */}
      <div className="p-6 flex-1 space-y-2.5">
        {galat && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{galat}</span>
          </div>
        )}

        {!run && !galat && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Tekan <strong>Jalankan Agent</strong>. Agent akan membaca prioritas toko, memeriksa substitusi, menahan
            reorder yang tidak perlu, dan menyusun draf PO. Setiap langkah muncul di sini selagi agent bekerja
            (±30-60 detik dengan LLM lokal).
          </p>
        )}

        {langkah.map((l, i) => {
          const hasil = hasilLangkah(l);
          const target = l.input?.inventory_id;
          const fase = FASE_TOOL[l.tool] || 'ACT';
          return (
            <div key={i} className="flex gap-3 text-xs">
              <span className="font-mono text-[10px] font-bold text-[#4e8a6e] w-14 shrink-0 pt-0.5">{fase}</span>
              <div className="flex-1 min-w-0 border-l-2 border-slate-200 pl-3 pb-1">
                <div className="font-bold text-slate-800">
                  {NAMA_TOOL[l.tool] || l.tool}
                  {target && <span className="font-medium text-slate-500"> &bull; {namaSku[target] || target}</span>}
                </div>
                {l.input?.alasan && (
                  <div className="text-slate-500 italic mt-0.5">&ldquo;{l.input.alasan}&rdquo;</div>
                )}
                <div className={`mt-0.5 flex flex-wrap items-center gap-2 ${hasil.buruk ? 'text-red-700' : 'text-slate-600'}`}>
                  {hasil.buruk && <ShieldAlert className="w-3.5 h-3.5" />}
                  <span>{hasil.teks}</span>
                  {hasil.poId && (
                    <button
                      onClick={() => onBukaPo?.(hasil.poId)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1b4d3e] text-white font-bold text-[10px] hover:bg-[#143d31]"
                    >
                      <Send className="w-3 h-3" /> Tinjau &amp; setujui
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {berjalan && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pl-[68px]">
            <span className="animate-pulse w-2 h-2 rounded-full bg-[#4e8a6e]" />
            {menunggu ? 'Menunggu worker agent di laptop mengambil tugas...' : 'Agent sedang berpikir...'}
          </div>
        )}

        {/* Review */}
        {run && !berjalan && (
          <div className={`mt-4 rounded-xl border p-4 ${run.status === 'SELESAI' ? 'bg-[#f0f7f4] border-[#a2d2bf]' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#1b4d3e] mb-2">
              {run.status === 'SELESAI'
                ? <CheckCircle2 className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4 text-red-600" />}
              <span>
                Review: {run.status === 'SELESAI' ? 'ringkasan agent' : 'agent gagal'}
                {run.durasi_dtk ? ` · ${run.durasi_dtk} dtk` : ''}
                {` · ${langkah.length} tool`}
                {jumlahDiblokir ? ` · ${jumlahDiblokir} aksi diblokir guardrail` : ''}
              </span>
            </div>
            <div className="text-xs text-slate-700 space-y-0.5 max-h-72 overflow-y-auto pr-1">
              <TeksAgent teks={run.jawaban || run.pesan || ''} />
            </div>
            {run.model && <div className="text-[10px] text-slate-400 mt-2">Model: {run.model}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
