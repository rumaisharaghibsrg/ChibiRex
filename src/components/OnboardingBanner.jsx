import React, { useState } from 'react';
import { 
  Package, 
  TrendingUp, 
  ArrowRightLeft,
  Bell,
  Zap,
  X
} from 'lucide-react';

/**
 * OnboardingBanner — ditampilkan di atas dashboard.
 * Menjelaskan 3 fungsi utama platform kepada pengguna baru dengan bahasa
 * yang sederhana, visual ikon, dan bisa ditutup (dismiss).
 */
export default function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const features = [
    {
      icon: Bell,
      color: 'bg-red-50 text-red-600',
      title: 'Deteksi Stok Otomatis',
      desc: 'AI mendeteksi produk mana yang hampir habis dan secara otomatis menyiapkan pesanan pembelian — tidak perlu cek manual.',
    },
    {
      icon: Package,
      color: 'bg-emerald-50 text-emerald-700',
      title: 'Rekomendasi Restock Cerdas',
      desc: 'Sistem menyarankan jumlah dan waktu restock yang tepat berdasarkan kecepatan penjualan historis setiap produk.',
    },
    {
      icon: ArrowRightLeft,
      color: 'bg-blue-50 text-blue-600',
      title: 'Realokasi Modal Deadstock',
      desc: 'Produk yang lambat terjual teridentifikasi otomatis. Dana yang "tertahan" bisa dialihkan ke produk laris yang butuh restock.',
    },
    {
      icon: Zap,
      color: 'bg-violet-50 text-violet-600',
      title: '1-Click Tindakan',
      desc: 'Setiap rekomendasi bisa langsung dieksekusi dengan satu klik — draf PO otomatis dikirim ke sistem SAP tanpa pindah halaman.',
    },
  ];

  return (
    <div className="relative bg-white rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Top accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-[#1b4d3e] via-[#4e8a6e] to-[#a2d2bf]" />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#4e8a6e]" />
              <h2 className="text-sm font-bold text-slate-800">
                Selamat datang di Rexa Copilot
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-lg">
              Platform AI untuk manajemen inventori otomatis — pantau stok, cegah kehabisan produk, dan optimalkan modal kas Anda dalam satu dashboard.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-300 hover:text-slate-500 transition-colors p-1 ml-4 shrink-0"
            title="Tutup panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-3 p-4 bg-slate-50/70 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg ${f.color} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1">{f.title}</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom tip */}
        <p className="mt-4 text-[11px] text-slate-300 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
          Coba skenario simulasi di bawah untuk melihat sistem bereaksi secara real-time.
        </p>
      </div>
    </div>
  );
}
