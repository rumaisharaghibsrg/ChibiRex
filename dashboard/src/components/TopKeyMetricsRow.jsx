import React from 'react';
import { 
  Activity, 
  Lock, 
  AlertTriangle, 
  TrendingUp, 
  ArrowDownRight,
  ShieldCheck
} from 'lucide-react';

export default function TopKeyMetricsRow({ kpis }) {
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const score = kpis?.healthScore ?? 84;
  const status = kpis?.healthStatus ?? "Sangat Sehat";
  const trend = kpis?.healthTrend ?? "+4.2% vs bln lalu";

  // Circular gauge calculations
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

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
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 truncate">
                  {status}
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
        </div>

        {/* Footer Insight */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <span className="truncate min-w-0 font-medium">Turnover &amp; kas stabil</span>
          <span className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
            <TrendingUp className="w-3 h-3 mr-0.5" />
            {trend}
          </span>
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
              {formatRupiah(kpis.capitalSaved)}
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-snug break-words">
              Hemat carrying cost simpan: <strong className="text-slate-700 font-semibold">{formatRupiah(kpis.carryingCostSaved)}/thn</strong>
            </p>
          </div>
        </div>

        {/* Footer Insight */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <span className="truncate min-w-0 font-medium">Suppression Engine aktif</span>
          <span className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
            <TrendingUp className="w-3 h-3 mr-0.5" />
            +Rp 14.5 Jt bln ini
          </span>
        </div>
      </div>

      {/* ── KARTU 3: TINGKAT STOCKOUT ── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all min-w-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Tingkat Stockout
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          {/* Metric Value */}
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight tabular-nums break-words">
              {kpis.stockoutRate}%
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1.5 leading-snug break-words">
              Baseline industri ritel: <span className="line-through text-slate-400 font-medium">{kpis.stockoutBaseline}%</span> (Turun 81%)
            </p>
          </div>
        </div>

        {/* Footer Insight */}
        <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-2">
          <span className="truncate min-w-0 font-medium">Dynamic ROP aktif</span>
          <span className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
            <ArrowDownRight className="w-3 h-3 mr-0.5" />
            -9.3% risiko churn
          </span>
        </div>
      </div>
    </div>
  );
}
