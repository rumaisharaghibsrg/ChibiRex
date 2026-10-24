import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Send, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { rupiah, tanggal } from '../lib/format';

// Draf PO dari agent yang menunggu 1-Click Approval, plus PO terakhir yang sudah masuk SAP beserta status
// kedatangannya menurut jam simulasi (`tanggalSim`, ISO).
export default function PendingPoCard({ store, refreshKey, tanggalSim, onBukaPo }) {
  const [draf, setDraf] = useState([]);
  const [disetujui, setDisetujui] = useState([]);

  useEffect(() => {
    let aktif = true;
    Promise.all([
      api.daftarPo({ store, status: 'DRAFT' }),
      api.daftarPo({ store, status: 'APPROVED', limit: 3 }),
    ])
      .then(([d, a]) => {
        if (!aktif) return;
        setDraf(d || []);
        setDisetujui(a || []);
      })
      .catch(() => {
        // Silent fail handling: jangan tampilkan banner galat merah di layar utama
        if (aktif) {
          setDraf([]);
          setDisetujui([]);
        }
      });
    return () => {
      aktif = false;
    };
  }, [store, refreshKey]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">
              PO Menunggu Persetujuan
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Level 2: agent menyusun draf, manajer yang memutuskan
            </p>
          </div>
        </div>

        {draf.length > 0 && (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            {draf.length} Draf
          </span>
        )}
      </div>

      <div className="p-6 flex-1 space-y-3 flex flex-col justify-between">
        <div className="space-y-3">
          {draf.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
              <ClipboardCheck className="w-8 h-8 text-slate-300 mb-2 stroke-1" />
              <p className="font-semibold text-slate-600">Tidak ada draf PO tertunda</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Jalankan Agent Rexa untuk menyusun rekomendasi draf pengadaan baru.
              </p>
            </div>
          ) : (
            draf.map((po) => (
              <div key={po.po_id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-[13px] leading-snug truncate">
                      {po.deskripsi}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {po.qty} unit &bull; <strong className="text-slate-700">{rupiah(po.nilai_idr)}</strong> &bull; {po.vendor_name}
                    </div>
                  </div>
                  <button
                    onClick={() => onBukaPo(po.po_id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-[11px] bg-[#1b4d3e] hover:bg-[#143d31] text-white shadow-2xs transition-all active:scale-95 whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 text-[#a2d2bf]" />
                    1-Click Approval
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {disetujui.length > 0 && (
          <div className="pt-4 border-t border-slate-100 mt-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Sudah masuk SAP S/4HANA
            </div>
            <div className="space-y-1.5">
              {disetujui.map((po) => (
                <div key={po.po_id} className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="flex items-center gap-1.5 text-slate-700 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="min-w-0">
                      <span className="truncate font-medium block">{po.deskripsi}</span>
                      {po.tgl_tiba && (
                        <span className="text-[10px] text-slate-400 block">
                          {tanggalSim && po.tgl_tiba <= tanggalSim ? 'Sudah tiba' : 'Dalam pengiriman, tiba'} {tanggal(po.tgl_tiba)}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                    SAP {po.sap_po_number}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
