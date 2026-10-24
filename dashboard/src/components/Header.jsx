import React from 'react';
import {
  ChevronDown,
  MapPin,
  SlidersHorizontal,
  FlaskConical,
  Check,
  Database
} from 'lucide-react';
import { angka, tanggal } from '../lib/format';

// Hanya Level 2 yang dijalankan sistem sekarang; Level 3 baru masuk Fase 3 proposal.
const levelOtonomi = [
  {
    level: "Level 1",
    title: "Preskriptif",
    desc: "Agen hanya menyajikan analisis dan rekomendasi di layar.",
    status: "Belum aktif"
  },
  {
    level: "Level 2",
    title: "Draf + Persetujuan",
    desc: "Agen menyusun draf PO; PO baru dikirim ke SAP setelah 1-Click Approval manajer.",
    status: "Aktif"
  },
  {
    level: "Level 3",
    title: "Otomatis Penuh",
    desc: "PO otomatis untuk SKU rutin bernilai rendah di bawah batas belanja.",
    status: "Segera hadir"
  }
];

export default function Header({
  stores = [],
  store,
  setStore,
  perTanggal,
  apiOk = true,
  activeTab,
  skenario = [],
  onSkenario,
  skenarioBerjalan
}) {
  const tokoAktif = stores.find((s) => s.store === store);
  const labelToko = tokoAktif ? `Toko ${tokoAktif.store} · ${tokoAktif.kota}` : `Toko ${store}`;

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: "Executive Inventory Dashboard",
          subtitle: "Kesehatan inventaris, modal kas, dan tindakan agent Rexa untuk toko yang dipilih"
        };
      case 'reorder':
        return {
          title: "Smart Reorder & Predictive Stockout",
          subtitle: "SKU yang perlu reorder, prediksi tanggal habis, dan 1-Click Approval PO ke SAP"
        };
      case 'reallocation':
        return {
          title: "Capital Reallocation Engine",
          subtitle: "Modal dari reorder yang ditahan dialihkan ke SKU yang penjualannya naik"
        };
      default:
        return {
          title: "Rexa Inventory Copilot",
          subtitle: "Agentic AI untuk stok dan arus kas usaha"
        };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-30 h-auto min-h-18 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
      {/* Left: Page Title & Context (Wrap rapi di layar HP) */}
      <div className="min-w-0 w-full md:w-auto">
        <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight leading-snug">
          {pageInfo.title}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
          {pageInfo.subtitle}
        </p>
      </div>

      {/* Right Controls (Wrap rapi tanpa terpotong di HP/tablet) */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full md:w-auto justify-start md:justify-end">
        {/* Branch Selector (GET /stores) */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors">
            <MapPin className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" />
            <span className="truncate max-w-[150px] sm:max-w-none">{labelToko}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-180 transition-transform shrink-0" />
          </button>

          <div className="absolute left-0 sm:left-auto right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 py-2 hidden group-hover:block z-50">
            <div className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Pilih Toko ({stores.length} toko Bibitor)
            </div>
            <div className="max-h-80 overflow-y-auto">
              {stores.map((s) => (
                <button
                  key={s.store}
                  onClick={() => setStore(s.store)}
                  className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center justify-between gap-3 ${
                    store === s.store ? 'text-[#1b4d3e] font-bold bg-[#eaf4ef]' : 'text-slate-700 font-semibold hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">Toko {s.store} · {s.kota}{s.store === 74 ? ' (demo)' : ''}</span>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {angka(s.perlu_reorder)} perlu reorder
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Autonomy Level Pill (informasi; hanya Level 2 yang berjalan) */}
        <div className="relative group/auto">
          <button className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#eaf4ef] border border-emerald-200 text-xs font-bold text-[#1b4d3e] hover:bg-[#d8ece2] transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" />
            <span>Level 2 (Draf PO)</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#4e8a6e] group-hover/auto:rotate-180 transition-transform shrink-0" />
          </button>

          <div className="absolute left-0 sm:left-auto right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 p-3 hidden group-hover/auto:block z-50">
            <div className="text-xs font-bold text-slate-900 mb-2 px-1">
              Tingkat Otonomi Agen
            </div>
            <div className="space-y-1">
              {levelOtonomi.map((item) => {
                const aktif = item.status === 'Aktif';
                return (
                  <div
                    key={item.level}
                    className={`w-full text-left p-2.5 rounded-xl text-xs ${
                      aktif ? 'bg-[#1b4d3e] text-white font-bold' : 'text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{item.level}: {item.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        aktif ? 'bg-white/15 text-[#a2d2bf]' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className={`text-[10px] mt-0.5 leading-snug ${aktif ? 'text-[#a2d2bf]' : 'text-slate-400'}`}>
                      {item.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Skenario Uji Guardrail (memanggil API sungguhan) */}
        {onSkenario && (
          <div className="relative group/scenario">
            <button className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors">
              {skenarioBerjalan ? (
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#1b4d3e] border-t-transparent rounded-full shrink-0" />
              ) : (
                <FlaskConical className="w-3.5 h-3.5 text-[#1b4d3e] shrink-0" />
              )}
              <span>Skenario Uji</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover/scenario:rotate-180 transition-transform shrink-0" />
            </button>

            <div className="absolute left-0 sm:left-auto right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 p-2.5 hidden group-hover/scenario:block z-50">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100 pb-2 mb-1.5">
                Uji guardrail dengan data asli
              </div>
              <div className="space-y-1">
                {skenario.map((sc) => {
                  const nonaktif = sc.disabled || Boolean(skenarioBerjalan);
                  return (
                    <button
                      key={sc.id}
                      onClick={() => onSkenario(sc.id)}
                      disabled={nonaktif}
                      className="w-full text-left p-2.5 rounded-xl text-xs transition-colors text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{sc.label}</span>
                        {skenarioBerjalan === sc.id && <Check className="w-3.5 h-3.5 text-[#1b4d3e]" />}
                      </div>
                      <div className="text-[10px] mt-0.5 leading-snug text-slate-400">
                        {sc.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Status API & tanggal data */}
        <div
          className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700"
          title={apiOk ? 'API Rexa terhubung' : 'API Rexa tidak bisa dihubungi'}
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${apiOk ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <Database className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <span className="text-slate-500 text-[11px]">
            Data simulasi{perTanggal ? ` · ${tanggal(perTanggal)}` : ''}
          </span>
        </div>
      </div>
    </header>
  );
}
