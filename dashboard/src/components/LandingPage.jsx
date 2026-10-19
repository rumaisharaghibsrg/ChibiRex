import React from 'react';
import RexaLogo from './RexaLogo';
import { 
  ShieldCheck, 
  TrendingUp, 
  Package,
  ArrowRight,
  Zap,
  Play
} from 'lucide-react';

const benefits = [
  {
    icon: Package,
    title: 'Pantau stok secara otomatis',
    desc: 'Tahu persis produk mana yang hampir habis, tanpa cek manual satu per satu.',
  },
  {
    icon: TrendingUp,
    title: 'Rekomendasi restock yang tepat',
    desc: 'AI menyarankan kapan dan berapa banyak harus pesan ulang, berdasarkan data penjualan nyata.',
  },
  {
    icon: Zap,
    title: 'Eksekusi 1-Click SAP',
    desc: 'Setujui pesanan pembelian langsung dari dashboard — terhubung langsung ke SAP S/4HANA.',
  },
  {
    icon: ShieldCheck,
    title: 'Modal tidak terbuang sia-sia',
    desc: 'Identifikasi produk yang lambat terjual dan alihkan dananya ke produk yang lebih laris.',
  },
];

export default function LandingPage({ onLogin, onRegister, onDemo }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9f4] via-white to-[#eaf4ef] flex flex-col">
      {/* Top Nav */}
      <nav className="px-8 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <RexaLogo className="h-10 w-auto" />
        <div className="flex items-center gap-3">
          <button
            onClick={onDemo}
            className="text-xs font-bold text-[#1b4d3e] bg-[#eaf4ef] hover:bg-[#d8ece2] px-4 py-2.5 rounded-xl transition-colors border border-emerald-200"
          >
            Buka Demo Dashboard
          </button>
          <button
            onClick={onLogin}
            className="text-xs font-bold text-slate-700 hover:text-[#1b4d3e] px-4 py-2.5 rounded-xl transition-colors"
          >
            Masuk
          </button>
          <button
            onClick={onRegister}
            className="text-xs font-bold bg-[#1b4d3e] text-white px-5 py-2.5 rounded-xl hover:bg-[#143d31] transition-colors shadow-sm"
          >
            Daftar Akun
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-3xl mx-auto w-full">
        {/* Genuine Brand Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="/rexa-logo-transparent.png"
            alt="Rexa Logo"
            className="h-28 w-auto object-contain drop-shadow-sm select-none"
          />
        </div>

        {/* Badge */}
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[#1b4d3e] bg-[#eaf4ef] border border-emerald-300 px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Agentic AI Hackathon 2026: Intelligent Inventory &amp; Cash Flow Copilot
        </span>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-5">
          Stok selalu siap,<br />
          <span className="text-[#1b4d3e]">modal kerja terlindungi.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-base text-slate-600 leading-relaxed mb-10 max-w-xl font-medium">
          Rexa menghubungkan data persediaan gudang dengan kondisi keuangan usaha secara real-time. 
          Otomatisasi pengadaan preskriptif, cegah kehabisan barang unggulan, dan alihkan dana dari produk mati.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={onDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-[#1b4d3e] text-white font-extrabold text-sm rounded-2xl hover:bg-[#143d31] transition-all shadow-lg shadow-[#1b4d3e]/20 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-white text-white" />
            <span>Eksplorasi Live Demo Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 bg-white text-slate-700 font-bold text-sm rounded-2xl hover:bg-slate-50 transition-all border border-slate-300 shadow-xs"
          >
            Masuk ke Akun
          </button>
        </div>
      </main>

      {/* Benefits strip */}
      <section className="max-w-6xl mx-auto w-full px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] border border-emerald-200 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[#1b4d3e]" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-1.5">{b.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-slate-400 border-t border-slate-200/80 bg-white">
        © 2026 Rexa Copilot &bull; AWS Bedrock &amp; SAP BTP S/4HANA Integration &bull; Agentic AI Hackathon
      </footer>
    </div>
  );
}
