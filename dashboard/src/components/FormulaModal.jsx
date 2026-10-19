import React from 'react';
import { X, Calculator } from 'lucide-react';

export default function FormulaModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1b4d3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#a2d2bf] flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                Logika Formula Matematika Rexa
              </h3>
              <p className="text-xs text-[#a2d2bf]">
                Sales Velocity Score (Vs) & Dynamic Reorder Point Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Formula 1: Sales Velocity */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="font-bold text-xs text-slate-900 block mb-2 uppercase tracking-wider">
              1. Formula Sales Velocity Score (Vs)
            </span>
            <div className="p-4 bg-white rounded-lg border border-slate-200 font-mono text-center text-sm font-bold text-[#1b4d3e] my-2 shadow-2xs">
              Vs = [ Σ(t=1..n) St ] ÷ [ n × Iavg ]
            </div>
            <ul className="space-y-1.5 text-slate-600 mt-3">
              <li>• <strong>St</strong>: Unit penjualan riil pada periode waktu t.</li>
              <li>• <strong>n</strong>: Jumlah hari dalam rentang observasi (default 30 hari).</li>
              <li>• <strong>Iavg</strong>: Rata-rata tingkat persediaan fisik yang tersedia di rak/gudang.</li>
            </ul>
          </div>

          {/* Formula 2: Dynamic Reorder Point */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <span className="font-bold text-xs text-slate-900 block mb-2 uppercase tracking-wider">
              2. Dynamic Reorder Point (Bukan Min-Max Statis)
            </span>
            <div className="p-4 bg-white rounded-lg border border-slate-200 font-mono text-center text-sm font-bold text-[#1b4d3e] my-2 shadow-2xs">
              ROP = (Lead Time Demand) + Safety Stock Dinamis
            </div>
            <p className="text-slate-600 mt-2 leading-relaxed">
              Titik pemesanan ulang menyesuaikan fluktuasi lead time supplier aktual dan target service level per SKU, mengantisipasi stockout tanpa menumpuk modal mati.
            </p>
          </div>

          {/* Threshold Action Table */}
          <div>
            <span className="font-bold text-xs text-slate-900 block mb-2">
              Interpretasi Keputusan Otonom Agen:
            </span>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#eaf4ef] text-[#1b4d3e] font-bold text-[11px]">
                  <tr>
                    <th className="p-2.5">Nilai Vs</th>
                    <th className="p-2.5">Klasifikasi</th>
                    <th className="p-2.5">Tindakan Otonom Agen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr>
                    <td className="p-2.5 font-bold font-mono text-emerald-700">Vs &gt; 1.2</td>
                    <td className="p-2.5">Fast-Moving</td>
                    <td className="p-2.5">Hitung prediksi stockout & susun draf PO SAP otomatis</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold font-mono text-blue-700">0.6 ≤ Vs ≤ 1.2</td>
                    <td className="p-2.5">Healthy Turnover</td>
                    <td className="p-2.5">Monitoring pasokan harian reguler</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold font-mono text-red-700">Vs &lt; 0.6</td>
                    <td className="p-2.5">Slow-Moving</td>
                    <td className="p-2.5">Aktifkan Suppression Engine (Hold Reorder) hemat modal</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1b4d3e] text-white font-bold text-xs hover:bg-[#143d31] transition-colors"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
