import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  AlertOctagon, 
  FileText
} from 'lucide-react';
import { sapAuditLogs } from '../data/mockData';

export default function GuardrailsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('failsafe'); // 'failsafe' | 'audit'

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1b4d3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#a2d2bf] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                Manajemen Risiko & Failsafe Berlapis
              </h3>
              <p className="text-xs text-[#a2d2bf]">
                Jaring pengaman Enterprise Agentic AI untuk perlindungan modal & transaksi
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200/80 bg-slate-50 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('failsafe')}
            className={`py-3 px-4 border-b-2 transition-all ${
              activeTab === 'failsafe'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Matriks Mitigasi Risiko & Failsafe
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-4 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'audit'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Trail & Idempotency Log SAP</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === 'failsafe' ? (
            <div className="space-y-3">
              {failsafeList.map((item, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-[#4e8a6e]" />
                      {item.risk}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ✓ {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">Dampak Potensial:</span> {item.impact}
                  </p>

                  <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200/90">
                    <strong className="text-[#1b4d3e]">Strategi Mitigasi:</strong> {item.mitigation}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Audit Log View */
            <div className="space-y-3">
              <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
                <span>Catatan log transaksi pengadaan otonom ke SAP Integration Suite:</span>
                <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                  Sinkronisasi Real-Time
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
                {sapAuditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.productName}</span>
                        <span className="font-mono text-slate-400 text-[10px]">({log.skuId})</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                          {log.sapPoNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{log.type}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">{log.idempotencyKey}</span>
                      </div>
                    </div>

                    <div className="text-right sm:text-right">
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
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Sistem Guardrails memenuhi standar audit perbankan & ERP Enterprise.
          </span>
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
