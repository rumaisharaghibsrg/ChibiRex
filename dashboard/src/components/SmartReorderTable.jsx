import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  PauseCircle, 
  Send, 
  Clock, 
  ShieldCheck, 
  FileText
} from 'lucide-react';

export default function SmartReorderTable({ 
  inventoryList, 
  onSelectPo, 
  onViewSuppression 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = ['ALL', 'Coffee Beans', 'Syrups & Flavors', 'Dairy & Alternative', 'Packaging', 'Powders & Tea'];

  const filteredItems = inventoryList.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      filterStatus === 'ALL' ? true :
      filterStatus === 'DRAFT_PO' ? item.agentStatus === 'DRAFT_PO' :
      filterStatus === 'HOLD_REORDER' ? item.agentStatus === 'HOLD_REORDER' :
      filterStatus === 'AUTO_EXECUTED' ? item.agentStatus === 'AUTO_EXECUTED' : true;

    const matchesCategory = 
      selectedCategory === 'ALL' ? true : item.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getSalesVelocityBadge = (score) => {
    if (score >= 1.5) {
      return {
        label: 'Sangat Laris',
        value: `${score.toFixed(2)}x`,
        style: 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
      };
    }
    if (score >= 0.8) {
      return {
        label: 'Normal',
        value: `${score.toFixed(2)}x`,
        style: 'bg-slate-100 text-slate-700 border-slate-200 font-semibold'
      };
    }
    return {
      label: 'Lambat (Slow)',
      value: `${score.toFixed(2)}x`,
      style: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
    };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden w-full">
      {/* ── Table Toolbar Responsif ── */}
      <div className="p-4 sm:p-6 border-b border-slate-200/80 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
            Smart Reorder &amp; Predictive Stockout
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Daftar SKU prioritas dengan deteksi tanggal habis &amp; otorisasi 1-Click PO SAP
          </p>
        </div>

        {/* Filter Controls (Wrap dengan rapi di layar kecil) */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama produk / SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9.5 pr-4 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b4d3e]/20 focus:border-[#1b4d3e] text-slate-800 placeholder:text-slate-400 w-full transition-all"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b4d3e]/20 cursor-pointer w-full sm:w-auto"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </option>
            ))}
          </select>

          {/* Status Filters (Scrollable horizontal container pada layar sempit) */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-bold gap-1 overflow-x-auto max-w-full">
            {[
              { id: 'ALL', label: `Semua (${inventoryList.length})` },
              { id: 'DRAFT_PO', label: `Butuh Approval (${inventoryList.filter(i => i.agentStatus === 'DRAFT_PO').length})` },
              { id: 'HOLD_REORDER', label: `Hold Reorder (${inventoryList.filter(i => i.agentStatus === 'HOLD_REORDER').length})` },
              { id: 'AUTO_EXECUTED', label: `Auto PO (${inventoryList.filter(i => i.agentStatus === 'AUTO_EXECUTED').length})` },
            ].map((f) => {
              const isActive = filterStatus === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap text-xs shrink-0 ${
                    isActive 
                      ? 'bg-[#1b4d3e] text-white shadow-xs font-bold' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 5 Clean Columns Data Table (Scroll Horizontal Aman di HP & Tablet) ── */}
      <div className="overflow-x-auto w-full overscroll-x-contain">
        <table className="w-full min-w-[720px] text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
              <th className="py-4 px-4 sm:px-6 min-w-[200px]">Nama Produk</th>
              <th className="py-4 px-4 sm:px-6 min-w-[120px] whitespace-nowrap">Stok</th>
              <th className="py-4 px-4 sm:px-6 min-w-[130px] whitespace-nowrap">Kecepatan Jual</th>
              <th className="py-4 px-4 sm:px-6 min-w-[140px] whitespace-nowrap">Prediksi Habis</th>
              <th className="py-4 px-4 sm:px-6 min-w-[170px] text-right whitespace-nowrap">Tindakan Otonom</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-16 text-center text-slate-400 text-xs">
                  Tidak ditemukan produk yang cocok dengan pencarian.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const isUrgent = item.agentStatus === 'DRAFT_PO';
                const isHold = item.agentStatus === 'HOLD_REORDER';
                const isAuto = item.agentStatus === 'AUTO_EXECUTED';
                const stockLow = item.currentStock <= item.reorderPoint;
                const vsBadge = getSalesVelocityBadge(item.salesVelocityScore);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* 1. Nama Produk */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[200px]">
                      <div className="font-bold text-slate-900 text-[13px] leading-snug break-words">
                        {item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                        <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-bold shrink-0">
                          {item.id}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.category}
                        </span>
                        <span className="text-slate-300 hidden sm:inline">&bull;</span>
                        <span className="text-[11px] text-slate-400">
                          {item.branch}
                        </span>
                      </div>
                    </td>

                    {/* 2. Stok (Clean, Tanpa Badge ROP yang Penuh Clutter) */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[120px] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {stockLow && (
                          <span 
                            className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0" 
                            title={`Stok di bawah titik ROP (${item.reorderPoint} ${item.unit})`}
                          />
                        )}
                        <span className={`text-sm font-extrabold tabular-nums ${stockLow ? 'text-rose-600' : 'text-slate-900'}`}>
                          {item.currentStock}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {item.unit}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block font-medium">
                        ROP: {item.reorderPoint} {item.unit}
                      </span>
                    </td>

                    {/* 3. Skor Kecepatan Jual */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[130px] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap ${vsBadge.style}`}>
                          {vsBadge.label} ({vsBadge.value})
                        </span>
                      </div>
                    </td>

                    {/* 4. Prediksi Habis */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[140px] whitespace-nowrap">
                      {isHold ? (
                        <div>
                          <span className="font-bold text-slate-700 text-xs">
                            Cukup ~{item.stockoutDaysRemaining} Hari
                          </span>
                          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold block w-fit mt-1">
                            Stok Melimpah (Slow)
                          </span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Clock className={`w-3.5 h-3.5 ${item.stockoutDaysRemaining <= 3 ? 'text-rose-600' : 'text-amber-600'}`} />
                            <span className={`text-xs font-bold tabular-nums ${item.stockoutDaysRemaining <= 3 ? 'text-rose-600' : 'text-slate-800'}`}>
                              {item.stockoutDaysRemaining <= 1
                                ? 'Habis Hari Ini!'
                                : `Sisa ${item.stockoutDaysRemaining.toFixed(1)} Hari`}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                            Keyakinan AI: {item.stockoutConfidence}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* 5. Tombol Aksi */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[170px] text-right whitespace-nowrap">
                      {isUrgent && (
                        <button
                          onClick={() => onSelectPo(item)}
                          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-[#1b4d3e] hover:bg-[#143d31] text-white shadow-2xs hover:shadow-xs transition-all active:scale-95 whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5 text-[#a2d2bf]" />
                          <span>1-Click Approval (SAP)</span>
                        </button>
                      )}

                      {isHold && (
                        <button
                          onClick={() => onViewSuppression(item)}
                          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 transition-colors whitespace-nowrap"
                        >
                          <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Tahan Reorder &bull; Cek Alasan</span>
                        </button>
                      )}

                      {isAuto && (
                        <button
                          onClick={() => onSelectPo(item)}
                          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 transition-colors whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-600" />
                          <span>Lihat PO SAP (Auto L3)</span>
                        </button>
                      )}

                      {!isUrgent && !isHold && !isAuto && (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold text-xs bg-slate-100 px-3 py-1.5 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Stok Terkendali
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Table Footer Responsif ── */}
      <div className="p-4 px-4 sm:px-6 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2 sm:gap-3">
        <span className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-[#1b4d3e] shrink-0" />
          <span>Pengamanan sistem: Level 2 mewajibkan otorisasi manajer sebelum PO diteruskan ke SAP BTP.</span>
        </span>
        <span className="font-bold text-slate-700 tabular-nums shrink-0">
          Menampilkan {filteredItems.length} dari {inventoryList.length} SKU Aktif
        </span>
      </div>
    </div>
  );
}
