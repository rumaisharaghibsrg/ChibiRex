import React from 'react';
import {
  ArrowRight,
  Sparkles,
  CheckCircle,
  ArrowRightLeft,
  Send
} from 'lucide-react';
import { angka, rupiah } from '../lib/format';

// Realokasi tidak punya aksi sendiri di backend: dana dari Hold Reorder benar-benar dipakai saat manajer menyetujui
// draf PO SKU tujuan. Karena itu tombol di kartu ini membuka draf PO tujuan.
export default function CapitalReallocationCard({ realokasi, poList = [], onBukaPo }) {
  if (!realokasi) {
    return <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs h-72 animate-pulse" />;
  }

  const adaDana = realokasi.dana_tersedia_idr > 0;
  const dialokasikan = realokasi.tujuan.filter((t) => t.dialokasikan_idr > 0);
  const tujuanTampil = (dialokasikan.length ? dialokasikan : realokasi.tujuan).slice(0, 3);
  const totalDialokasikan = dialokasikan.reduce((t, x) => t + x.dialokasikan_idr, 0);

  const poTujuan = (inventoryId) =>
    poList.find((p) => p.inventory_id === inventoryId && p.status === 'DRAFT') ??
    poList.find((p) => p.inventory_id === inventoryId && p.status === 'APPROVED');
  const drafPertama = tujuanTampil.map((t) => poTujuan(t.inventory_id)).find((p) => p?.status === 'DRAFT');
  const semuaDisetujui = tujuanTampil.length > 0 && tujuanTampil.every((t) => poTujuan(t.inventory_id)?.status === 'APPROVED');

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-7 py-5 bg-gradient-to-r from-slate-50 via-white to-emerald-50/30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#eaf4ef] border border-emerald-200 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5 text-[#1b4d3e]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
              Capital Reallocation Recommendation
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Modal dari reorder yang ditahan dialihkan ke SKU yang penjualannya naik
            </p>
          </div>
        </div>

        {semuaDisetujui ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3.5 py-1.5 rounded-full">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            PO tujuan sudah masuk SAP
          </span>
        ) : adaDana ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-300 px-3.5 py-1.5 rounded-full">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Peluang Efisiensi Kas Terdeteksi
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 px-3.5 py-1.5 rounded-full">
            Belum ada modal untuk dialihkan
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="p-7 space-y-6">
        {/* Transfer Visual Flow */}
        <div className="grid grid-cols-1 md:grid-cols-11 items-stretch gap-4">
          {/* Source Box (Hold Reorder) */}
          <div className="md:col-span-5 bg-red-50/50 border border-red-200 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Sumber: Hold Reorder
                </span>
                <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                  Penjualan turun
                </span>
              </div>
              {realokasi.sumber.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Belum ada reorder yang ditahan. Agent menahan reorder SKU yang penjualannya turun dan tidak berperan komplementer.
                </p>
              ) : (
                <ul className="space-y-2">
                  {realokasi.sumber.map((h) => (
                    <li key={h.hold_id} className="flex items-start justify-between gap-3 text-xs">
                      <span className="font-bold text-slate-900 leading-snug">{h.deskripsi}</span>
                      <span className="font-mono font-bold text-red-600 whitespace-nowrap">{rupiah(h.modal_diselamatkan_idr)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-red-200/60 flex items-center justify-between bg-white/80 rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-600">Modal Kas Diselamatkan</span>
              <span className="text-base font-extrabold text-red-600 font-mono">
                {rupiah(realokasi.dana_tersedia_idr)}
              </span>
            </div>
          </div>

          {/* Transfer Arrow */}
          <div className="md:col-span-1 flex flex-col items-center justify-center gap-2 py-2">
            <div className="w-10 h-10 rounded-full bg-[#1b4d3e] text-white flex items-center justify-center shadow-md">
              <ArrowRight className="w-5 h-5 text-[#a2d2bf] hidden md:block" />
              <ArrowRight className="w-5 h-5 text-[#a2d2bf] rotate-90 md:hidden" />
            </div>
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Alihkan
            </span>
          </div>

          {/* Target Box (penjualan naik) */}
          <div className="md:col-span-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  Target: Penjualan Naik
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                  Perlu reorder
                </span>
              </div>
              {tujuanTampil.length === 0 ? (
                <p className="text-xs text-slate-500">Tidak ada SKU dengan penjualan naik yang perlu reorder.</p>
              ) : (
                <ul className="space-y-2">
                  {tujuanTampil.map((t) => {
                    const po = poTujuan(t.inventory_id);
                    return (
                      <li key={t.inventory_id} className="text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-slate-900 leading-snug">{t.deskripsi}</span>
                          <span className="font-mono font-bold text-[#1b4d3e] whitespace-nowrap">
                            {adaDana ? rupiah(t.dialokasikan_idr) : rupiah(t.nilai_po_idr)}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Naik {angka(t.tren_beli)}x
                          {po?.status === 'DRAFT' && ' · draf PO siap'}
                          {po?.status === 'APPROVED' && ` · PO SAP #${po.sap_po_number}`}
                          {!po && ' · belum ada draf PO'}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between bg-white/80 rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-slate-600">Alokasi Modal Tambahan</span>
              <span className="text-base font-extrabold text-[#1b4d3e] font-mono">
                {rupiah(totalDialokasikan)}
              </span>
            </div>
          </div>
        </div>

        {/* Business Impact Summary & Action Button */}
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col gap-4">
          <p className="text-xs text-slate-600 leading-relaxed">{realokasi.pesan}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            <div className="bg-white rounded-xl p-4 border border-slate-200/70 flex-1 w-full min-w-0">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Dana Tersedia
              </span>
              <span className="text-base font-extrabold text-slate-900 mt-1 block">
                {rupiah(realokasi.dana_tersedia_idr)}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Dari {realokasi.sumber.length} Hold Reorder aktif
              </span>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200/70 flex-1 w-full min-w-0">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Dialokasikan
              </span>
              <span className="text-base font-extrabold text-emerald-700 mt-1 block">
                {rupiah(totalDialokasikan)}
              </span>
              <span className="text-xs text-emerald-700 font-medium mt-0.5 block">
                Ke {dialokasikan.length} SKU penjualan naik
              </span>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200/70 flex-1 w-full min-w-0">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Sisa Dana
              </span>
              <span className="text-base font-extrabold text-slate-800 mt-1 block">
                {rupiah(realokasi.sisa_dana_idr)}
              </span>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Tetap di kas toko
              </span>
            </div>
          </div>

          {adaDana && !semuaDisetujui && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
              {!drafPertama && (
                <span className="text-xs text-slate-500">
                  Belum ada draf PO untuk SKU tujuan. Jalankan agent untuk menyusunnya.
                </span>
              )}
              <button
                onClick={() => drafPertama && onBukaPo?.(drafPertama.po_id)}
                disabled={!drafPertama}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-95 whitespace-nowrap bg-[#1b4d3e] hover:bg-[#143d31] text-white hover:shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                <Send className="w-4 h-4 text-[#a2d2bf]" />
                <span>Tinjau Draf PO Tujuan</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
