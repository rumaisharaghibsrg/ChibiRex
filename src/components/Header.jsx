import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, 
  CheckCircle2, 
  ShieldCheck, 
  Bell, 
  MapPin, 
  SlidersHorizontal 
} from 'lucide-react';

export default function Header({ 
  currentBranch, 
  setCurrentBranch, 
  autonomyLevel, 
  setAutonomyLevel, 
  openGuardrailsModal,
  urgentCount = 0,
  activeTab
}) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const branches = [
    "Hub Jakarta Pusat (Flagship)",
    "Gudang Surabaya Barat",
    "Central Roastery Bandung",
    "Semua Cabang (Konsolidasi)"
  ];

  const getPageInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: "Executive Inventory Dashboard",
          subtitle: "Pantauan real-time kesehatan inventaris, efisiensi modal kas, & perputaran barang"
        };
      case 'reorder':
        return {
          title: "Smart Reorder & Predictive Stockout",
          subtitle: "Tabel pengadaan preskriptif, prediksi tanggal kehabisan stok, & 1-Click PO SAP"
        };
      case 'reallocation':
        return {
          title: "Capital Reallocation Engine",
          subtitle: "Rekomendasi pengalihan likuiditas dari deadstock ke produk fast-moving beromzet tinggi"
        };
      default:
        return {
          title: "Rexa Inventory Copilot",
          subtitle: "Sistem Agentic AI pengaman rantai pasok dan likuiditas kas usaha"
        };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="sticky top-0 z-30 h-18 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-8 flex items-center justify-between shadow-2xs">
      {/* Left: Page Title & Context */}
      <div>
        <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
          {pageInfo.title}
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          {pageInfo.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Branch Selector */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-800 hover:bg-slate-100 transition-colors">
            <MapPin className="w-3.5 h-3.5 text-[#1b4d3e]" />
            <span>{currentBranch}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 py-2 hidden group-hover:block z-50">
            <div className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Pilih Cabang Gudang
            </div>
            {branches.map((b) => (
              <button
                key={b}
                onClick={() => setCurrentBranch(b)}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors ${
                  currentBranch === b ? 'text-[#1b4d3e] font-bold bg-[#eaf4ef]' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Autonomy Level Pill */}
        <div className="relative group/auto">
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#eaf4ef] border border-emerald-200 text-xs font-bold text-[#1b4d3e] hover:bg-[#d8ece2] transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#1b4d3e]" />
            <span>{autonomyLevel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#4e8a6e]" />
          </button>

          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] border border-slate-200 p-3 hidden group-hover/auto:block z-50">
            <div className="text-xs font-bold text-slate-900 mb-2 px-1 flex items-center justify-between">
              <span>Tingkat Otonomi Agen</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">Proposal Guardrails</span>
            </div>
            <div className="space-y-1">
              {[
                { 
                  level: "Level 1", 
                  title: "Preskriptif", 
                  desc: "Agen hanya menyajikan analisis dan rekomendasi pasif di layar." 
                },
                { 
                  level: "Level 2", 
                  title: "Draf + Persetujuan (Default)", 
                  desc: "Agen menyusun draf PO ke SAP BTP, namun eksekusi wajib 1-Click Approval Manajer." 
                },
                { 
                  level: "Level 3", 
                  title: "Otomatis Penuh", 
                  desc: "PO otomatis berlaku khusus SKU rutin bernilai rendah di bawah batas spending." 
                }
              ].map((item) => (
                <button
                  key={item.level}
                  onClick={() => setAutonomyLevel(item.level)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-colors ${
                    autonomyLevel.includes(item.level)
                      ? 'bg-[#1b4d3e] text-white font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{item.level}: {item.title}</span>
                  </div>
                  <div className={`text-[10px] mt-0.5 leading-snug ${autonomyLevel.includes(item.level) ? 'text-[#a2d2bf]' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Sync</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-mono text-[11px]">{timeStr || '14:21 WIB'}</span>
        </div>
      </div>
    </header>
  );
}
