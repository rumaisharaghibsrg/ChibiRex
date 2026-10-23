import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertOctagon, 
  FileText,
  CheckCircle2
} from 'lucide-react';
import { sapAuditLogs } from '../data/mockData';

// Master daftar failsafe guardrail (didefinisikan di level modul di luar komponen)
const failsafeList = [
  {
    risk: "Death Spiral (Bias Algoritma)",
    impact: "Produk di-hold ➔ stok kosong ➔ data penjualan nol ➔ dikira mati permanen selamanya.",
    mitigation: "Exploration budget kuartalan (alokasi stok uji pasar); pemisahan analitik data 'nol karena tanpa peminat' vs 'nol karena stok habis'.",
    status: "Aktif (Budget Q4: Rp 15 Juta)"
  },
  {
    risk: "Runaway PO (Pemesanan Liar)",
    impact: "Pembelian borongan temporer / spike promo terbaca algoritma sebagai tren lonjakan permanen.",
    mitigation: "Filter outlier statistik (> 3σ sigma); batas nominal PO harian (max Rp 150 Juta); circuit breaker otomatis saat anomali.",
    status: "Aktif (Batas Harian: Aman)"
  },
  {
    risk: "Inakurasi Data Stok Gudang",
    impact: "Selisih fisik vs sistem ERP (5%–10%) memicu keputusan pemesanan yang keliru.",
    mitigation: "Data Confidence Score per SKU. Jika berada di bawah ambang 85%, agen otomatis beralih ke rekomendasi audit stock opname fisik.",
    status: "Aktif (Rata-rata: 95.8%)"
  },
  {
    risk: "PO Ganda & Risiko Legal",
    impact: "Network retry atau duplikasi transmisi menyebabkan pemesanan terkirim berulang ke vendor.",
    mitigation: "Strict Idempotency Key per transaksi pengadaan; status default Draf PO (Level 2); rollback log tersertifikasi.",
    status: "Aktif (Idempotency Lock OK)"
  },
  {
    risk: "Prompt Injection pada LLM",
    impact: "Manipulasi teks supplier atau catatan PO untuk membajak instruksi AI Copilot.",
    mitigation: "Isolasi tegas: LLM Copilot beroperasi secara Read-Only murni; semua perubahan state wajib lewat REST API tervalidasi.",
    status: "Aktif (Read-Only Sandbox)"
  }
];

// Deduplikasi statis: menjamin setiap risiko hanya muncul 1 kali tanpa memicu pelanggaran Rules of Hooks
const uniqueFailsafeList = failsafeList.filter((item, index, self) => {
  const normKey = item.risk.toLowerCase().replace(/[^a-z0-9]/g, '');
  return index === self.findIndex(t => t.risk.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey);
});

export default function GuardrailsModal({ isOpen, onClose }) {
  // ATURAN REACT HOOKS: Semua Hooks dipanggil di baris paling atas (top-level) sebelum early return
  const [activeTab, setActiveTab] = useState('failsafe'); // 'failsafe' | 'audit'

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header ala Vercel / Linear Enterprise */}
        <div className="p-6 border-b border-slate-200/80 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] border border-[#a2d2bf]/50 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#1b4d3e]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 tracking-tight">
                  Manajemen Risiko &amp; Failsafe Berlapis
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  5 Failsafes Aktif
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Jaring pengaman Enterprise Agentic AI untuk perlindungan likuiditas modal &amp; audit transaksi ERP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Minimalist Segmented Navigation Tabs */}
        <div className="flex border-b border-slate-200/80 bg-slate-50/70 px-6 text-xs font-semibold gap-2 pt-2">
          <button
            onClick={() => setActiveTab('failsafe')}
            className={`py-2.5 px-4 rounded-t-lg transition-all border-b-2 ${
              activeTab === 'failsafe'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Matriks Mitigasi Risiko &amp; Failsafe
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-2.5 px-4 rounded-t-lg flex items-center gap-1.5 transition-all border-b-2 ${
              activeTab === 'audit'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Trail &amp; Idempotency Log SAP</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-3.5 bg-slate-50/40">
          {activeTab === 'failsafe' ? (
            <div className="space-y-3">
              {uniqueFailsafeList.map((item) => (
                <div 
                  key={item.risk}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-[#1b4d3e] shrink-0" />
                      {item.risk}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-2 leading-relaxed">
                    <span className="font-semibold text-slate-700">Dampak Potensial:</span> {item.impact}
                  </p>

                  <div className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                    <strong className="text-[#1b4d3e] font-bold">Strategi Mitigasi:</strong> {item.mitigation}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Audit Log View */
            <div className="space-y-3">
              <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                <span>Catatan log transaksi pengadaan otonom ke SAP Integration Suite:</span>
                <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Sinkronisasi Real-Time
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                {sapAuditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.productName}</span>
                        <span className="font-mono text-slate-400 text-[10px]">({log.skuId})</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-semibold">
                          {log.sapPoNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                        <span>{log.type}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">{log.idempotencyKey}</span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <div className="font-bold text-slate-900">{log.amount}</div>
                      <div className="text-[10px] text-slate-400">{log.timestamp}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-white border-t border-slate-200/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Sistem Guardrails memenuhi standar audit perbankan &amp; ERP Enterprise.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
