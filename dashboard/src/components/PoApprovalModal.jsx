import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle,
  Send,
  ShieldCheck,
  ShieldAlert,
  FileCode,
  Sparkles,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';
import { rupiah } from '../lib/format';

// 1-Click Approval untuk satu draf PO dari API. Setelah disetujui, API membuat PO di (tiruan) SAP S/4HANA
// dan mengembalikan nomor PO SAP; kalau SAP gagal, PO tetap DRAFT dan galatnya ditampilkan.
// Pasang dengan key={poId} supaya state-nya mulai bersih untuk setiap PO.
export default function PoApprovalModal({ poId, penyetuju, onClose, onSelesai }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'payload'
  const [po, setPo] = useState(null);
  const [payload, setPayload] = useState(null);
  const [galat, setGalat] = useState(null);
  const [mengirim, setMengirim] = useState(false);
  const [hasil, setHasil] = useState(null); // PO setelah disetujui atau ditolak

  useEffect(() => {
    if (!poId) return undefined;
    let aktif = true;
    Promise.all([api.po(poId), api.payloadSap(poId)])
      .then(([p, s]) => {
        if (!aktif) return;
        setPo(p);
        setPayload(s);
      })
      .catch((e) => aktif && setGalat(e.message));
    return () => {
      aktif = false;
    };
  }, [poId]);

  if (!poId) return null;

  const putuskan = async (setuju) => {
    setMengirim(true);
    setGalat(null);
    try {
      const baru = setuju
        ? await api.setujuiPo(poId, penyetuju, '1-Click Approval dari dashboard')
        : await api.tolakPo(poId, penyetuju, 'Ditolak dari dashboard');
      setHasil(baru);
      onSelesai?.(baru);
      if (setuju) {
        try {
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 }, colors: ['#1b4d3e', '#4e8a6e', '#8fbc8f', '#a2d2bf'] });
        } catch {
          // animasi saja; abaikan kalau canvas tidak tersedia
        }
      }
    } catch (e) {
      setGalat(e.message);
    } finally {
      setMengirim(false);
    }
  };

  const bisaDiputuskan = po?.status === 'DRAFT' && !hasil;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1b4d3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#a2d2bf] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">1-Click Approval Draf Purchase Order</h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#a2d2bf] text-[#1b4d3e]">
                  Level 2 Otonomi
                </span>
              </div>
              <p className="text-xs text-[#a2d2bf] mt-0.5">
                Setelah disetujui, PO dibuat di SAP S/4HANA (tiruan OData API_PURCHASEORDER_PROCESS_SRV)
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

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 bg-[#f4f7f6] px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === 'summary'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-[#1b4d3e]'
            }`}
          >
            Ringkasan Pengadaan
          </button>
          <button
            onClick={() => setActiveTab('payload')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'payload'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-[#1b4d3e]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Payload SAP (OData)</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {galat && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{galat}</span>
            </div>
          )}

          {!po && !galat && <p className="text-xs text-slate-500">Memuat draf PO...</p>}

          {hasil ? (
            <div className="py-8 text-center space-y-3">
              {hasil.status === 'APPROVED' ? (
                <>
                  <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                    <CheckCircle className="w-12 h-12" />
                  </div>
                  <h4 className="text-xl font-extrabold text-[#1b4d3e]">Purchase Order Berhasil Dibuat di SAP</h4>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">
                    Disetujui oleh {hasil.diputuskan_oleh}. {hasil.deskripsi}: {hasil.qty} unit, {rupiah(hasil.nilai_idr)}.
                  </p>
                  <div className="inline-block bg-[#f4f7f6] border border-[#a2d2bf] p-3 rounded-xl font-mono text-sm text-[#1b4d3e] font-bold mt-2">
                    SAP PO #: <span className="text-emerald-700">{hasil.sap_po_number}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="inline-flex p-4 rounded-full bg-slate-100 text-slate-500 mb-2">
                    <XCircle className="w-12 h-12" />
                  </div>
                  <h4 className="text-xl font-extrabold text-slate-700">Draf PO Ditolak</h4>
                  <p className="text-xs text-gray-600">Tidak ada yang dikirim ke SAP.</p>
                </>
              )}
            </div>
          ) : po && activeTab === 'summary' ? (
            <>
              {/* Produk dan supplier */}
              <div className="bg-[#f4f7f6] p-4 rounded-xl border border-gray-200">
                <div className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">
                  Detail Material &amp; Supplier
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-[#1b4d3e] text-base">{po.deskripsi}</div>
                    <div className="text-xs text-gray-600 font-mono mt-0.5">SKU: {po.inventory_id} | PO: {po.po_id}</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                    Toko {po.store}
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-200/60 text-xs text-gray-600">
                  Supplier: <strong className="text-gray-800">{po.vendor_name}</strong>
                </div>
              </div>

              {/* Rincian nilai */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white border border-gray-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase block">Kuantitas</span>
                  <span className="text-lg font-extrabold text-[#1b4d3e]">{po.qty} unit</span>
                </div>
                <div className="p-3 bg-white border border-gray-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase block">Harga Satuan</span>
                  <span className="text-lg font-extrabold text-gray-800">{rupiah(po.nilai_idr / po.qty)}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-800 uppercase block font-semibold">Total Nilai PO</span>
                  <span className="text-lg font-extrabold text-emerald-700">{rupiah(po.nilai_idr)}</span>
                  <span className="text-[10px] text-emerald-800 block mt-0.5">Simulasi (kurs tetap)</span>
                </div>
              </div>

              {/* Penalaran agent dan guardrail */}
              <div className="bg-white p-4 rounded-xl border border-[#1b4d3e]/15 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1b4d3e]">
                  <Sparkles className="w-4 h-4 text-[#4e8a6e]" />
                  <span>Alasan dari {po.dibuat_oleh}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed bg-[#f4f7f6] p-2.5 rounded-lg">{po.alasan}</p>

                {po.pelanggaran.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 pt-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Lolos guardrail: filter 3σ, batas PO harian, Data Confidence, dan circuit breaker</span>
                  </div>
                ) : (
                  po.pelanggaran.map((p) => (
                    <div key={p.kode} className="flex items-start gap-1.5 text-[11px] text-red-700 pt-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span><strong>{p.kode}</strong>: {p.pesan}</span>
                    </div>
                  ))
                )}
              </div>

              {po.status !== 'DRAFT' && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  Status PO: <strong>{po.status}</strong>
                  {po.sap_po_number && <> &bull; SAP PO #{po.sap_po_number}</>}. Hanya draf yang bisa diputuskan.
                </div>
              )}
            </>
          ) : payload ? (
            /* Payload SAP */
            <div>
              <div className="flex justify-between items-center gap-3 text-xs text-gray-500 mb-2">
                <span className="font-mono truncate">{payload.tujuan}</span>
                <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded shrink-0">application/json</span>
              </div>
              <pre className="p-4 bg-gray-900 text-[#a2d2bf] rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-72">
                {JSON.stringify(payload.payload, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          {bisaDiputuskan ? (
            <>
              <button
                onClick={() => putuskan(false)}
                disabled={mengirim}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                Tolak Draf
              </button>
              <button
                onClick={() => putuskan(true)}
                disabled={mengirim}
                className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#1b4d3e] hover:bg-[#143d31] disabled:opacity-60 text-white shadow-md hover:shadow-lg flex items-center gap-2 transition-all active:scale-95"
              >
                {mengirim ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Mengirim ke SAP...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[#a2d2bf]" />
                    <span>1-Click Otorisasi &amp; Kirim ke SAP</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto px-5 py-2 rounded-xl bg-[#1b4d3e] text-white font-bold text-xs hover:bg-[#143d31] transition-colors"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
