import React, { useState } from 'react';
import {
  Activity,
  Lock,
  AlertTriangle,
  ChevronDown,
  ShieldCheck
} from 'lucide-react';
import { angka, rupiah, rupiahRingkas, tanggal } from '../lib/format';

// Label Health Score; ambangnya sama untuk semua toko.
const statusHealth = (skor) => {
  if (skor >= 80) return { label: 'Sehat', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (skor >= 60) return { label: 'Perlu perhatian', className: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: 'Kritis', className: 'bg-red-50 text-red-700 border-red-200' };
};

export default function TopKeyMetricsRow({ ringkasan, jumlahHold = 0 }) {
  const [rincianTerbuka, setRincianTerbuka] = useState(false);

  const score = ringkasan?.health_score ?? 0;
  const status = statusHealth(score);
  const komponen = ringkasan?.komponen ?? [];
  const terendah = komponen.length ? komponen.reduce((a, b) => (b.nilai < a.nilai ? b : a)) : null;
  const perluReorder = ringkasan?.jumlah_status?.REORDER ?? 0;
  const persenReorder = ringkasan?.sku_aktif ? (perluReorder / ringkasan.sku_aktif) * 100 : 0;
  const persenTertahan = ringkasan?.nilai_stok_idr ? (ringkasan.modal_tertahan_idr / ringkasan.nilai_stok_idr) * 100 : 0;

  // Circular gauge calculations
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  if (!ringkasan) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200/90 p-6 h-44 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    /* Grid Responsif: 1 kolom (atas-bawah) di layar kecil/HP & tablet portrait, 3 kolom horizontal di layar besar (lg:) */
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
      {/* ── KARTU 1: INVENTORY HEALTH ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all min-w-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Inventory Health
            </span>
            <div className="w-8 h-8 rounded-xl bg-[#eaf4ef] border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#1b4d3e]" />
            </div>
          </div>

          {/* Metric Content with Gauge */}
          <div className="flex items-center justify-between gap-3 sm:gap-4 my-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-none tabular-nums">
                  {score}
                </span>
                <span className="text-xs font-semibold text-slate-400">/ 100</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border truncate ${status.className}`}>
                  {status.label}
                </span>
              </div>
            </div>

            {/* Circular Ring Gauge */}
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  className="text-slate-100"
                  strokeWidth="6"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  stroke="#1b4d3e"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#1b4d3e] absolute" />
            </div>
          </div>

          {/* Rincian komponen Health Score */}
          {rincianTerbuka && (
            <div className="mt-3 space-y-2">
              {komponen.map((k) => (
                <div key={k.kode} title={k.penjelasan}>
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                    <span>{k.nama}</span>
                    <span className="tabular-nums">{angka(k.nilai)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                    <div className="h-full bg-[#1b4d3e] rounded-full" style={{ width: `${k.nilai}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-400 leading-snug">{ringkasan.rumus}.</p>
            </div>
          )}
        </div>

        {/* Footer Insight */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <span className="truncate min-w-0 font-medium">
            {terendah ? `Terendah: ${terendah.nama.toLowerCase()} ${angka(terendah.nilai)}` : `Per ${tanggal(ringkasan.per_tanggal)}`}
          </span>
          <button
            onClick={() => setRincianTerbuka(!rincianTerbuka)}
            className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 transition-colors"
          >
            {rincianTerbuka ? 'Tutup' : 'Rincian'}
            <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${rincianTerbuka ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KARTU 2: MODAL TERSELAMATKAN ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all min-w-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Modal Terselamatkan
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-[#1b4d3e]" />
            </div>
          </div>

          {/* Metric Value */}
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight tabular-nums break-words">
              {rupiah(ringkasan.modal_diselamatkan_idr)}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-snug break-words">
              Modal tertahan di stok menumpuk: <strong className="text-slate-700 font-semibold">{rupiahRingkas(ringkasan.modal_tertahan_idr)}</strong> ({angka(persenTertahan)}% nilai stok)
            </p>
          </div>
        </div>

        {/* Footer Insight */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <span className="truncate min-w-0 font-medium">Dari Hold Reorder yang aktif</span>
          <span className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
            {jumlahHold} SKU ditahan
          </span>
        </div>
      </div>

      {/* ── KARTU 3: RISIKO STOK HABIS ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all min-w-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Risiko Stok Habis
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          {/* Metric Value */}
          <div className="my-2">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight tabular-nums">
                {angka(ringkasan.sku_risiko_tinggi)}
              </span>
              <span className="text-xs font-semibold text-slate-400">SKU risiko tinggi</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-snug break-words">
              {angka(perluReorder)} dari {angka(ringkasan.sku_aktif)} SKU aktif ({angka(persenReorder)}%) sudah di bawah reorder point
            </p>
          </div>
        </div>

        {/* Footer Insight */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <span className="truncate min-w-0 font-medium">Skor risiko ≥ 90 (model LightGBM, indikatif)</span>
        </div>
      </div>
    </div>
  );
}
