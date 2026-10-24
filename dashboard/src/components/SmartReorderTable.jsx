import React, { useMemo, useState } from 'react';
import {
  Search,
  PauseCircle,
  Send,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CircleDashed
} from 'lucide-react';
import { angka, angka2, tanggal } from '../lib/format';

// arah_tren dihitung API dari tren_beli (pembelian Okt-Des dibanding Jan-Sep per bulan).
const BADGE_TREN = {
  NAIK: { label: 'Naik', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  STABIL: { label: 'Stabil', style: 'bg-slate-100 text-slate-700 border-slate-200' },
  TURUN: { label: 'Turun', style: 'bg-rose-50 text-rose-800 border-rose-200' },
  TIDAK_ANDAL: { label: 'Data tidak andal', style: 'bg-amber-50 text-amber-800 border-amber-200' },
};

// Label pendek kode pelanggaran guardrail PO (api/guardrails.py); pesan lengkapnya ada di tooltip dan modal PO.
const LABEL_PELANGGARAN = {
  OUTLIER_3SIGMA: 'Outlier 3σ',
  BATAS_HARIAN: 'Batas harian',
  CIRCUIT_BREAKER: 'Circuit breaker',
  DATA_CONFIDENCE_RENDAH: 'Data Confidence',
};

const labelDitahan = (pelanggaran) => {
  if (!pelanggaran.length) return 'guardrail';
  const [pertama, ...lain] = pelanggaran.map((p) => LABEL_PELANGGARAN[p.kode] ?? p.kode);
  return lain.length ? `${pertama} +${lain.length}` : pertama;
};

const statusBaris = ({ po, hold }) => {
  if (po?.status === 'DRAFT') return 'DRAFT';
  if (po?.status === 'DITAHAN_GUARDRAIL') return 'DITAHAN';
  if (hold) return 'HOLD';
  if (po?.status === 'APPROVED') return 'APPROVED';
  return 'BELUM';
};

export default function SmartReorderTable({
  baris = [],
  memuat = false,
  batas,
  onLihatSemua,
  onSelectPo,
  onViewSuppression
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = useMemo(
    () => ['ALL', ...[...new Set(baris.map((b) => b.sku.jenis).filter(Boolean))].sort()],
    [baris]
  );

  const filteredItems = baris.filter((b) => {
    const cari = searchTerm.toLowerCase();
    const matchesSearch =
      (b.sku.deskripsi ?? '').toLowerCase().includes(cari) ||
      b.sku.inventory_id.toLowerCase().includes(cari) ||
      (b.sku.vendor_name ?? '').toLowerCase().includes(cari);

    const matchesStatus = filterStatus === 'ALL' ? true : statusBaris(b) === filterStatus;

    const matchesCategory =
      selectedCategory === 'ALL' ? true : b.sku.jenis === selectedCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const jumlah = (status) => baris.filter((b) => statusBaris(b) === status).length;
  // Di halaman utama tabel dipotong; daftar lengkap ada di tab Smart Reorder.
  const ditampilkan = batas ? filteredItems.slice(0, batas) : filteredItems;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden w-full">
      {/* ── Table Toolbar Responsif ── */}
      <div className="p-4 sm:p-6 border-b border-slate-200/80 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 bg-white">
        <div className="min-w-0">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
            Smart Reorder &amp; Predictive Stockout
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            SKU di bawah reorder point, prediksi tanggal habis, dan tindakan agent
          </p>
        </div>

        {/* Filter Controls (Wrap dengan rapi di layar kecil) */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-52">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari produk / SKU / vendor..."
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
                {cat === 'ALL' ? 'Semua Jenis' : cat}
              </option>
            ))}
          </select>

          {/* Status Filters (Scrollable horizontal container pada layar sempit) */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl text-xs font-bold gap-1 overflow-x-auto max-w-full">
            {[
              { id: 'ALL', label: `Semua (${baris.length})` },
              { id: 'DRAFT', label: `Butuh Approval (${jumlah('DRAFT')})` },
              { id: 'DITAHAN', label: `Ditahan Guardrail (${jumlah('DITAHAN')})` },
              { id: 'HOLD', label: `Hold Reorder (${jumlah('HOLD')})` },
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
              <th className="py-4 px-4 sm:px-6 min-w-[130px] whitespace-nowrap">Tren Penjualan</th>
              <th className="py-4 px-4 sm:px-6 min-w-[140px] whitespace-nowrap">Prediksi Habis</th>
              <th className="py-4 px-4 sm:px-6 min-w-[170px] text-right whitespace-nowrap">Tindakan Agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-16 text-center text-slate-400 text-xs">
                  {memuat ? 'Memuat data SKU...' : 'Tidak ditemukan produk yang cocok dengan pencarian.'}
                </td>
              </tr>
            ) : (
              ditampilkan.map((b) => {
                const { sku, po } = b;
                const status = statusBaris(b);
                const stockLow = sku.stok_akhir <= sku.reorder_point;
                const tren = BADGE_TREN[sku.arah_tren] ?? BADGE_TREN.STABIL;
                const hari = sku.hari_cukup;
                const kritis = hari !== null && hari <= 3;

                return (
                  <tr
                    key={sku.inventory_id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* 1. Nama Produk */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[200px]">
                      <div className="font-bold text-slate-900 text-[13px] leading-snug break-words">
                        {sku.deskripsi} {sku.ukuran && <span className="text-slate-400 font-medium">{sku.ukuran}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                        <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-bold shrink-0">
                          {sku.inventory_id}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {sku.jenis}
                        </span>
                        <span className="text-slate-300 hidden sm:inline">&bull;</span>
                        <span className="text-[11px] text-slate-400">
                          {sku.vendor_name}
                        </span>
                      </div>
                    </td>

                    {/* 2. Stok */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[120px] whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {stockLow && (
                          <span
                            className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0"
                            title={`Stok di bawah reorder point (${angka(sku.reorder_point)} unit)`}
                          />
                        )}
                        <span className={`text-sm font-extrabold tabular-nums ${stockLow ? 'text-rose-600' : 'text-slate-900'}`}>
                          {angka(sku.stok_akhir)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          unit
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1 block font-medium">
                        ROP: {angka(sku.reorder_point)} unit
                      </span>
                      {sku.stok_dalam_pengiriman > 0 && (
                        <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold block w-fit mt-1">
                          +{angka(sku.stok_dalam_pengiriman)} dalam pengiriman
                        </span>
                      )}
                      {sku.stok_fisik !== null && sku.stok_fisik !== undefined && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-bold block w-fit mt-1">
                          Hitung fisik: {angka(sku.stok_fisik)} · DC {angka2(sku.data_confidence)}
                        </span>
                      )}
                    </td>

                    {/* 3. Tren Penjualan */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[130px] whitespace-nowrap">
                      <span className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap font-semibold ${tren.style}`}>
                        {tren.label}{sku.tren_beli !== null ? ` (${angka2(sku.tren_beli)}x)` : ''}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium mt-1.5 block">
                        Vs: {sku.vs_tahun !== null ? angka2(sku.vs_tahun) : '-'} · {angka(sku.permintaan_harian)} unit/hari
                      </span>
                    </td>

                    {/* 4. Prediksi Habis */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[140px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3.5 h-3.5 ${kritis ? 'text-rose-600' : 'text-amber-600'}`} />
                        <span className={`text-xs font-bold tabular-nums ${kritis ? 'text-rose-600' : 'text-slate-800'}`}>
                          {hari === null ? '-' : hari < 1 ? 'Sudah habis' : `Sisa ${angka(hari)} hari`}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium mt-0.5 block">
                        {sku.tgl_perkiraan_habis ? `${tanggal(sku.tgl_perkiraan_habis)} · ` : ''}
                        Skor risiko {sku.skor_risiko ?? '-'}{sku.level_risiko ? ` (${sku.level_risiko})` : ''}
                      </span>
                    </td>

                    {/* 5. Tombol Aksi */}
                    <td className="py-4.5 sm:py-5 px-4 sm:px-6 min-w-[170px] text-right whitespace-nowrap">
                      {status === 'DRAFT' && (
                        <button
                          onClick={() => onSelectPo(po.po_id)}
                          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs bg-[#1b4d3e] hover:bg-[#143d31] text-white shadow-2xs hover:shadow-xs transition-all active:scale-95 whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5 text-[#a2d2bf]" />
                          <span>1-Click Approval (SAP)</span>
                        </button>
                      )}

                      {status === 'DITAHAN' && (
                        <button
                          onClick={() => onSelectPo(po.po_id)}
                          title={po.pelanggaran.map((p) => p.pesan).join('\n')}
                          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs bg-red-50 hover:bg-red-100 text-red-800 border border-red-200/80 transition-colors whitespace-nowrap"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                          <span>Ditahan: {labelDitahan(po.pelanggaran)}</span>
                        </button>
                      )}

                      {status === 'HOLD' && (
                        <button
                          onClick={() => onViewSuppression(b)}
                          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 transition-colors whitespace-nowrap"
                        >
                          <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Hold Reorder &bull; Cek Alasan</span>
                        </button>
                      )}

                      {status === 'APPROVED' && (
                        <button
                          onClick={() => onSelectPo(po.po_id)}
                          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition-colors whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          <span>PO SAP #{po.sap_po_number}</span>
                        </button>
                      )}
                      {status === 'APPROVED' && po.tgl_tiba && (
                        <span className="block text-[10px] text-slate-400 mt-1">
                          {sku.stok_dalam_pengiriman > 0 ? `Tiba ${tanggal(po.tgl_tiba)}` : `Sudah tiba ${tanggal(po.tgl_tiba)}`}
                        </span>
                      )}

                      {status === 'BELUM' && (
                        <span className="inline-flex items-center gap-1.5 text-slate-500 font-semibold text-xs bg-slate-100 px-3 py-1.5 rounded-lg">
                          <CircleDashed className="w-3.5 h-3.5 text-slate-400" />
                          Belum ditindak agent
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
          <span>Level 2: setiap PO wajib disetujui manajer sebelum dikirim ke SAP (tiruan S/4HANA OData).</span>
        </span>
        <span className="flex items-center gap-3 shrink-0">
          <span className="font-bold text-slate-700 tabular-nums">
            Menampilkan {ditampilkan.length} dari {baris.length} SKU
          </span>
          {onLihatSemua && ditampilkan.length < filteredItems.length && (
            <button
              onClick={onLihatSemua}
              className="px-3 py-1.5 rounded-lg bg-[#1b4d3e] hover:bg-[#143d31] text-white font-bold text-xs whitespace-nowrap"
            >
              Lihat semua
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
