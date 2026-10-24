import React, { useState } from 'react';
import {
  Compass,
  HelpCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { angka, rupiah, rupiahRingkas, tanggal } from '../lib/format';

// Exploration budget = stok uji dari setiap Hold Reorder aktif (GET /holds): 10% PO tetap dibeli dan hold ditinjau
// ulang tiap kuartal, supaya produk yang ditahan tidak dianggap mati selamanya.
export default function ExplorationBudgetCard({ holds = [] }) {
  const [showExplanation, setShowExplanation] = useState(false);

  const aktif = holds.filter((h) => h.status === 'AKTIF');
  const nilaiUji = aktif.reduce((t, h) => t + h.nilai_uji_idr, 0);
  const unitUji = aktif.reduce((t, h) => t + h.qty_uji, 0);
  const modalDitahan = aktif.reduce((t, h) => t + h.modal_ditahan_idr, 0);
  const porsi = modalDitahan ? Math.round((nilaiUji / modalDitahan) * 100) : 0;
  const reviewBerikut = aktif.map((h) => h.review_pada).sort()[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 flex flex-col justify-between h-full">
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
              Karena itu setiap Hold Reorder tetap membeli 10% dari jumlah PO sebagai stok uji, dan hold ditinjau ulang tiap kuartal untuk melihat apakah permintaan bangkit kembali.
            </p>
          </div>
        )}

        {/* Progress Numbers */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Nilai Stok Uji
            </span>
            <span className="text-lg font-extrabold text-slate-900 mt-0.5 block font-mono truncate">
              {rupiahRingkas(nilaiUji)}
            </span>
            <span className="text-[10px] text-slate-400">
              {angka(unitUji)} unit · {rupiah(nilaiUji)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Reorder Ditahan
            </span>
            <span className="text-lg font-extrabold text-purple-700 mt-0.5 block font-mono truncate">
              {rupiahRingkas(modalDitahan)}
            </span>
            <span className="text-[10px] text-slate-400">
              Nilai PO tidak dibeli penuh
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-1.5">
            <span>Porsi stok uji dari reorder ditahan</span>
            <span className="text-purple-700 font-bold font-mono">{porsi}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-[#1b4d3e] rounded-full transition-all duration-700"
              style={{ width: `${porsi}%` }}
            />
          </div>
        </div>

        {aktif.length === 0 && (
          <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
            Belum ada Hold Reorder di toko ini. Jalankan agent: setiap reorder yang ditahan menyisakan stok uji di sini.
          </p>
        )}
      </div>

      {/* Footer Insight */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
          <span>{aktif.length} SKU uji pasar aktif</span>
        </span>
        {reviewBerikut && (
          <span className="font-bold text-slate-700 text-right">
            Review: {tanggal(reviewBerikut)}
          </span>
        )}
      </div>
    </div>
  );
}
