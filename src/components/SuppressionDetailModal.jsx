import React from 'react';
import { 
  X, 
  PauseCircle, 
  ArrowRightLeft, 
  ShieldCheck
} from 'lucide-react';

export default function SuppressionDetailModal({ item, onClose }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1b4d3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#a2d2bf] flex items-center justify-center">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">
                  Detail Suppression Engine (Hold Reorder)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">
                  Slow-Moving
                </span>
              </div>
              <p className="text-xs text-[#a2d2bf]">
                Penahanan pengadaan otomatis guna melindungi arus kas perusahaan
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
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Target SKU card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-sm text-slate-900 mb-1">
              {item.name} ({item.id})
            </div>
            <div className="text-slate-500 mb-2">
              Supplier: {item.supplier} • Lokasi: {item.branch}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-2.5 border-t border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block">Stok Riil</span>
                <span className="font-bold text-slate-800">{item.currentStock} {item.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Sales Velocity (Vs)</span>
                <span className="font-bold text-red-600 font-mono">{item.salesVelocityScore} (Rendah)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Waktu Habis Stok</span>
                <span className="font-bold text-slate-800">~{item.stockoutDaysRemaining} Hari</span>
              </div>
            </div>
          </div>

          {/* Market Basket Analysis Substitute */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <ArrowRightLeft className="w-4 h-4 text-blue-700" />
              <span>Analisis Substitusi Produk (Market Basket Analysis)</span>
            </div>
            <p className="text-blue-900/80 leading-relaxed">
              Produk pengganti teridentifikasi: <strong>{item.substituteSku || "Sirup Karamel Monin"}</strong>. 
              Data histori transaksi membuktikan 84% konsumen memilih varian karamel saat varian hazelnut tidak dipromosikan, tanpa mengurangi retensi pelanggan.
            </p>
          </div>

          {/* Capital Savings */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200">
            <div className="font-bold text-emerald-900 text-xs mb-1">
              Dampak Penyelamatan Likuiditas Kas:
            </div>
            <div className="text-lg font-bold text-emerald-800">
              Rp 5.500.000 Modal Kerja Diselamatkan
            </div>
            <p className="text-emerald-700 text-[11px] mt-1">
              Carrying cost sebesar Rp 1.375.000/tahun (25%) berhasil dieliminasi dari beban sewa & depresiasi gudang.
            </p>
          </div>

          {/* Exploration Budget Safeguard */}
          <div className="p-4 rounded-xl bg-[#eaf4ef]/60 border border-[#a2d2bf]/60 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[#1b4d3e]">
              <ShieldCheck className="w-4 h-4 text-[#4e8a6e]" />
              <span>Exploration Budget (Pencegah Death Spiral Algoritma)</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Untuk mencegah bias algoritma (*produk di-hold ➔ penjualan 0 ➔ dianggap mati selamanya*), sistem Rexa mengalokasikan stok uji berkala sebesar <strong>10 botol per kuartal</strong> guna menguji permintaan riil pasar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#1b4d3e] text-white font-bold text-xs hover:bg-[#143d31] transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
