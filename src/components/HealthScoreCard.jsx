import React from 'react';
import { Activity, ShieldCheck, TrendingUp, DollarSign, Info, CheckCircle2 } from 'lucide-react';

export default function HealthScoreCard({ 
  score = 84, 
  status = "Sangat Sehat", 
  trend = "+4.2% vs bln lalu",
  stockoutPreventionRate = 92,
  turnoverRatio = 88,
  cashFlowStability = 81
}) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return { stroke: '#1b4d3e', text: 'text-[#1b4d3e]', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (score >= 65) return { stroke: '#d97706', text: 'text-amber-700', badge: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { stroke: '#dc2626', text: 'text-red-700', badge: 'bg-red-50 text-red-800 border-red-200' };
  };

  const scoreTheme = getScoreColor();

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-7 shadow-xs flex flex-col justify-between w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] border border-emerald-200 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-[#1b4d3e]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
              Inventory Health Score
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Indikator tunggal integrasi risiko stockout, turnover, &amp; stabilitas kas
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <TrendingUp className="w-3.5 h-3.5" />
          {trend}
        </span>
      </div>

      {/* Main Meter & Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-6 my-auto py-2">
        {/* Left: Circular Gauge */}
        <div className="sm:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140">
              {/* Background Ring */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="text-slate-100"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Score Ring */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke={scoreTheme.stroke}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Center Content */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none">
                {score}
              </span>
              <span className="text-[11px] font-bold text-slate-400 tracking-wider mt-1">
                SKOR TOTAL / 100
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border mt-1.5 ${scoreTheme.badge}`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Right: 3 Metric Pillars */}
        <div className="sm:col-span-7 space-y-4">
          {/* Pillar 1 */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1b4d3e]" />
                Pencegahan Risiko Stockout
              </span>
              <span className="font-extrabold text-slate-900 font-mono">{stockoutPreventionRate}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#1b4d3e] rounded-full transition-all duration-700"
                style={{ width: `${stockoutPreventionRate}%` }}
              />
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#4e8a6e]" />
                Rasio Perputaran Barang (Turnover)
              </span>
              <span className="font-extrabold text-slate-900 font-mono">{turnoverRatio}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#4e8a6e] rounded-full transition-all duration-700"
                style={{ width: `${turnoverRatio}%` }}
              />
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Stabilitas Arus Kas Persediaan
              </span>
              <span className="font-extrabold text-slate-900 font-mono">{cashFlowStability}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                style={{ width: `${cashFlowStability}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-slate-400" />
          <span>Ambang batas aman minimum operasional: <strong>&gt; 70 poin</strong></span>
        </span>
        <span className="font-bold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Likuiditas Terlindungi
        </span>
      </div>
    </div>
  );
}
