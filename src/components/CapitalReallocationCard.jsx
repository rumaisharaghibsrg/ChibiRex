import React, { useState } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle, 
  ArrowRightLeft,
  TrendingUp,
  ShieldAlert,
  Coins,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CapitalReallocationCard({ onApplyReallocation, isReallocated }) {
  const [executing, setExecuting] = useState(false);

  const handleApply = () => {
    setExecuting(true);
    setTimeout(() => {
      onApplyReallocation();
      setExecuting(false);
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.65 },
          colors: ['#1b4d3e', '#4e8a6e', '#8fbc8f', '#a2d2bf']
        });
      } catch (_) {}
    }, 600);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-7 py-5 bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] border border-emerald-200 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-[#1b4d3e]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
              Capital Reallocation Recommendation
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Saran konkret pengalihan dana: selamatkan modal mati dari deadstock ke produk laris
            </p>
          </div>
        </div>

        {isReallocated ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3.5 py-1.5 rounded-full">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Modal Berhasil Dialihkan ke SAP
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-full animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Peluang Efisiensi Kas Terdeteksi
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-7 space-y-6">
        {/* Transfer Visual Flow */}
        <div className="grid grid-cols-1 md:grid-cols-11 items-stretch gap-4">
          {/* Source Box (Slow-Moving) */}
          <div className="md:col-span-5 bg-red-50/50 border border-red-200 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Sumber: Tahan Reorder (Suppression)
                </span>
                <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  Slow-Moving
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                SKU-002: Sirup Hazelnut Gourmet 750ml
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Stok tersedia 185 botol (cukup untuk 154 hari ke depan). Permintaan melambat -62%.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-red-200/60 flex items-center justify-between bg-white/80 rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-600">Modal Kas Diselamatkan</span>
              <span className="text-base font-extrabold text-red-600 font-mono">
                Rp 5.500.000
              </span>
            </div>
          </div>

          {/* Transfer Arrow */}
          <div className="md:col-span-1 flex flex-col items-center justify-center gap-2 py-2">
            <div className="w-10 h-10 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center shadow-md">
              <ArrowRight className="w-5 h-5 text-[#a2d2bf] hidden md:block" />
              <ArrowRight className="w-5 h-5 text-[#a2d2bf] rotate-90 md:hidden" />
            </div>
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Alihkan
            </span>
          </div>

          {/* Target Box (Fast-Moving) */}
          <div className="md:col-span-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Target: Tambah Restock Otomatis
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                  Fast-Moving (+38%)
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                SKU-001: Kopi Arabika Specialty 500g
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Sisa stok 42 pcs (hampir habis dalam 2.8 hari). Membutuhkan tambahan kuantitas PO segera.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between bg-white/80 rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-600">Alokasi Modal Tambahan</span>
              <span className="text-base font-extrabold text-[#1b4d3e] font-mono">
                Rp 5.500.000
              </span>
            </div>
          </div>
        </div>

        {/* Business Impact Summary & Action Button */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Cegah Stockout Loss
              </span>
              <span className="text-sm font-extrabold text-slate-900 mt-0.5 block">
                Rp 7.200.000
              </span>
              <span className="text-[10px] text-slate-500">Mencegah pembatalan order</span>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Proyeksi Margin Ekstra
              </span>
              <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                +Rp 2.320.000
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Dari perputaran cepat</span>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/70">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Substitusi Konsumen
              </span>
              <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">
                84% Beralih Karamel
              </span>
              <span className="text-[10px] text-slate-500">Konsumen tidak kecewa</span>
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={isReallocated || executing}
            className={`px-6 py-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 whitespace-nowrap shrink-0 ${
              isReallocated
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-[#1b4d3e] hover:bg-[#143d31] text-white hover:shadow-lg'
            }`}
          >
            {executing ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Menerapkan Realokasi Modal...</span>
              </>
            ) : isReallocated ? (
              <>
                <Check className="w-5 h-5 text-emerald-600" />
                <span>Realokasi Modal Berhasil Diterapkan</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#a2d2bf]" />
                <span>1-Click Terapkan Realokasi Modal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
