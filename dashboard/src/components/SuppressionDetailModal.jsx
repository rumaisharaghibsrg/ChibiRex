import React, { useEffect, useState } from 'react';
import {
  X,
  PauseCircle,
  ArrowRightLeft,
  ShieldCheck,
  Bot
} from 'lucide-react';
import { api } from '../lib/api';
import { angka, angka2, rupiah, tanggal } from '../lib/format';

const LABEL_KOMPLEMENTER = {
  TIDAK_KOMPLEMENTER: 'Tidak komplementer: pembeli tidak bergantung pada jenis ini, jadi aman ditahan.',
  KOMPLEMENTER: 'Komplementer: sering dibeli bersama jenis lain, jadi menahannya bisa menurunkan penjualan lain.',
  TIDAK_DIKETAHUI: 'Peran komplementer belum diketahui dari data keranjang belanja.',
};

// Dibuka dari baris Hold Reorder di tabel Smart Reorder. Parent memberi `key` per SKU supaya state reset.
export default function SuppressionDetailModal({ item, onClose }) {
  const [substitusi, setSubstitusi] = useState(null);
  const [error, setError] = useState(null);
  const inventoryId = item?.sku.inventory_id;

  useEffect(() => {
    if (!inventoryId) return;
    let batal = false;
    api.substitusi(inventoryId)
      .then((d) => { if (!batal) setSubstitusi(d); })
      .catch((e) => { if (!batal) setError(e.message); });
    return () => { batal = true; };
  }, [inventoryId]);

  if (!item) return null;
  const { sku, hold } = item;

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
                  Detail Hold Reorder
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">
                  Penjualan turun
                </span>
              </div>
              <p className="text-xs text-[#a2d2bf]">
                Penahanan pengadaan untuk melindungi arus kas toko
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
              {sku.deskripsi} ({sku.inventory_id})
            </div>
            <div className="text-slate-500 mb-2">
              Vendor: {sku.vendor_name} • Toko {sku.store} {sku.kota}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-2.5 border-t border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block">Stok Sistem</span>
                <span className="font-bold text-slate-800">{angka(sku.stok_akhir)} unit</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Tren Pembelian</span>
                <span className="font-bold text-red-600 font-mono">{angka2(sku.tren_beli)}x (turun)</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Stok Cukup</span>
                <span className="font-bold text-slate-800">{sku.hari_cukup === null ? '-' : `~${angka(sku.hari_cukup)} hari`}</span>
              </div>
            </div>
          </div>

          {/* Alasan agent */}
          {hold && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <Bot className="w-4 h-4 text-[#1b4d3e]" />
                <span>Alasan dari {hold.dibuat_oleh === 'agent' ? 'agent Rexa' : hold.dibuat_oleh}</span>
              </div>
              <p className="text-slate-600 leading-relaxed">{hold.alasan}</p>
            </div>
          )}

          {/* Peran komplementer (Market Basket Instacart) */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-blue-900">
              <ArrowRightLeft className="w-4 h-4 text-blue-700" />
              <span>Cek Peran Komplementer (Market Basket Instacart)</span>
            </div>
            {error && <p className="text-red-700">{error}</p>}
            {!error && !substitusi && <p className="text-blue-900/60">Memuat analisis keranjang belanja...</p>}
            {substitusi && (
              <>
                <p className="text-blue-900/80 leading-relaxed">
                  Jenis <strong>{substitusi.jenis}</strong>: {LABEL_KOMPLEMENTER[substitusi.status]}
                </p>
                {substitusi.mitra.length > 0 && (
                  <ul className="text-blue-900/80 space-y-0.5">
                    {substitusi.mitra.slice(0, 3).map((m) => (
                      <li key={m.jenis}>
                        • {m.jenis}: lift {angka2(m.lift_alk)}x, {angka(m.order_bersama)} order bersama
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Capital Savings */}
          {hold && (
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <div className="font-bold text-emerald-900 text-xs mb-1">
                Dampak Penyelamatan Likuiditas Kas:
              </div>
              <div className="text-lg font-bold text-emerald-800">
                {rupiah(hold.modal_diselamatkan_idr)} Modal Kerja Diselamatkan
              </div>
              <p className="text-emerald-700 text-[11px] mt-1">
                Reorder {angka(hold.qty_ditahan)} unit senilai {rupiah(hold.modal_ditahan_idr)} ditahan, dikurangi stok uji {rupiah(hold.nilai_uji_idr)}.
              </p>
            </div>
          )}

          {/* Exploration Budget Safeguard */}
          {hold && (
            <div className="p-4 rounded-xl bg-[#eaf4ef]/60 border border-[#a2d2bf]/60 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#1b4d3e]">
                <ShieldCheck className="w-4 h-4 text-[#4e8a6e]" />
                <span>Exploration Budget (Pencegah Death Spiral Algoritma)</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Untuk mencegah bias algoritma (*produk di-hold ➔ penjualan 0 ➔ dianggap mati selamanya*), Rexa tetap membeli <strong>{angka(hold.qty_uji)} unit stok uji</strong> dan meninjau ulang hold ini pada <strong>{tanggal(hold.review_pada)}</strong> (tanggal simulasi).
              </p>
            </div>
          )}
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
