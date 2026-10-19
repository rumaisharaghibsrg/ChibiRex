import React, { useState } from 'react';
import { 
  Compass, 
  HelpCircle, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Sparkles,
  Info
} from 'lucide-react';

export default function ExplorationBudgetCard({ explorationBudget }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const budget = explorationBudget || {
    allocated: 15000000,
    utilized: 4200000,
    remaining: 10800000,
    validationRate: "78% akurasi demand riil"
  };

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const percentageUsed = Math.round((budget.utilized / budget.allocated) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
              <Compass className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight leading-snug">
                Exploration Budget
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Pencegah bias algoritma <em className="text-purple-700 font-semibold not-italic">"Death Spiral"</em>
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            title="Penjelasan Fungsi Bisnis"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Explanation Drawer */}
        {showExplanation && (
          <div className="mb-4 p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-slate-700 space-y-1.5 animate-in fade-in">
            <div className="font-bold text-purple-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
              Mengapa Fitur Ini Vital Bagi Bisnis?
            </div>
            <p className="leading-relaxed text-slate-600 text-[11px]">
              Jika produk yang melambat di-hold terus-menerus, penjualan akan menjadi <strong>nol</strong> karena barang kosong di rak. Algoritma konvensional akan mengira produk itu <em>mati selamanya</em> (Death Spiral).
            </p>
            <p className="leading-relaxed text-slate-600 text-[11px]">
              Rexa mengalokasikan budget kuartalan terkontrol ini untuk memesan stok uji sampel berkala, menguji apakah permintaan pasar bangkit kembali tanpa mempertaruhkan modal besar.
            </p>
          </div>
        )}

        {/* Progress Numbers */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Budget Tersedia (Q4)
            </span>
            <span className="text-lg font-extrabold text-slate-900 mt-0.5 block font-mono">
              {formatRupiah(budget.remaining)}
            </span>
            <span className="text-[10px] text-slate-400">
              Dari total alokasi {formatRupiah(budget.allocated)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Telah Diuji Coba
            </span>
            <span className="text-lg font-extrabold text-purple-700 mt-0.5 block font-mono">
              {formatRupiah(budget.utilized)}
            </span>
            <span className="text-[10px] text-slate-400">
              {percentageUsed}% kuota kuartal ini
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
            <span>Alokasi Uji Sampel Kuartal Ini</span>
            <span className="text-purple-700 font-bold font-mono">{percentageUsed}% Terpakai</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-[#1b4d3e] rounded-full transition-all duration-700"
              style={{ width: `${percentageUsed}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Insight */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
          <span>4 SKU uji coba pasar aktif</span>
        </span>
        <span className="font-bold text-slate-700">
          Validasi: {budget.validationRate}
        </span>
      </div>
    </div>
  );
}
