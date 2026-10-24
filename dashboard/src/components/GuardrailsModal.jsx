import React, { useEffect, useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertOctagon,
  FileText,
  RotateCcw,
  ClipboardCheck
} from 'lucide-react';
import { api } from '../lib/api';
import { angka, angka2, rupiah, rupiahRingkas, waktu } from '../lib/format';

// Label audit log per aksi yang dicatat api/main.py.
const LABEL_AKSI = {
  draft_purchase_order: 'Draf PO dibuat',
  po_approved: 'PO disetujui & dikirim ke SAP',
  po_rejected: 'Draf PO ditolak',
  hold_reorder: 'Hold Reorder',
  hold_reorder_ditolak: 'Hold Reorder ditolak guardrail',
  circuit_breaker_terbuka: 'Circuit breaker terbuka',
  circuit_breaker_reset: 'Circuit breaker direset',
  catat_stok_fisik: 'Hitung fisik dicatat',
  audit_stok_selesai: 'Audit stok selesai',
  reset_demo: 'Data demo direset',
};

const ringkasAudit = (log) => {
  const d = log.detail ?? {};
  if (log.aksi === 'draft_purchase_order') {
    return d.pelanggaran?.length ? d.pelanggaran.join(', ') : `Status ${d.status}`;
  }
  if (log.aksi === 'po_approved' && d.sap_po_number) return `SAP PO #${d.sap_po_number}`;
  if (log.aksi === 'hold_reorder_ditolak') return d.pelanggaran?.join(', ');
  if (log.aksi === 'catat_stok_fisik') {
    return `Sistem ${angka(d.stok_sistem)} vs fisik ${angka(d.stok_fisik)} · DC ${angka2(d.data_confidence)}`;
  }
  return d.catatan ?? d.inventory_id ?? null;
};

const nilaiAudit = (d = {}) => d.nilai_idr ?? d.modal_diselamatkan_idr ?? null;

export default function GuardrailsModal({
  isOpen,
  onClose,
  guardrail,
  stokFisik = [],
  jumlahHold = 0,
  penyetuju = 'Manajer toko',
  onBerubah
}) {
  // ATURAN REACT HOOKS: Semua Hooks dipanggil di baris paling atas (top-level) sebelum early return
  const [activeTab, setActiveTab] = useState('failsafe'); // 'failsafe' | 'audit'
  const [auditLog, setAuditLog] = useState(null);
  const [catatanReset, setCatatanReset] = useState('Penyebab anomali sudah diperiksa');
  const [mengirim, setMengirim] = useState(false);
  const [pesan, setPesan] = useState(null);

  useEffect(() => {
    if (!isOpen || activeTab !== 'audit') return;
    let batal = false;
    api.auditLog(50)
      .then((d) => { if (!batal) setAuditLog(d); })
      .catch((e) => { if (!batal) setPesan({ galat: true, text: e.message }); });
    return () => { batal = true; };
  }, [isOpen, activeTab, guardrail]);

  if (!isOpen) return null;

  const tutup = () => {
    setPesan(null);
    onClose();
  };

  const breakerTerbuka = Boolean(guardrail?.circuit_breaker_terbuka);
  const perluAudit = stokFisik.filter((c) => c.perlu_audit);

  const jalankan = async (aksi, berhasil) => {
    setMengirim(true);
    setPesan(null);
    try {
      await aksi();
      setPesan({ galat: false, text: berhasil });
      onBerubah?.();
    } catch (e) {
      setPesan({ galat: true, text: e.message });
    } finally {
      setMengirim(false);
    }
  };

  const failsafeList = [
    {
      risk: "Death Spiral (Bias Algoritma)",
      impact: "Produk di-hold ➔ stok kosong ➔ data penjualan nol ➔ dikira mati permanen selamanya.",
      mitigation: "Exploration budget: 10% dari PO yang ditahan tetap dibeli sebagai stok uji, dan setiap hold ditinjau ulang tiap kuartal.",
      status: `Aktif (${jumlahHold} SKU uji)`,
      aman: true
    },
    {
      risk: "Runaway PO (Pemesanan Liar)",
      impact: "Pembelian borongan temporer / spike promo terbaca algoritma sebagai tren lonjakan permanen.",
      mitigation: guardrail
        ? `Qty di atas target stok + ${angka(guardrail.outlier_sigma)}σ permintaan ditahan; batas nominal PO harian ${rupiah(guardrail.batas_po_harian_idr)} per toko; circuit breaker terbuka setelah 3 PO ditahan dalam 60 menit.`
        : "Filter outlier 3σ, batas nominal PO harian, dan circuit breaker.",
      status: breakerTerbuka
        ? "Circuit breaker TERBUKA"
        : `Aktif (hari ini ${rupiahRingkas(guardrail?.total_po_hari_ini_idr ?? 0)} dari ${rupiahRingkas(guardrail?.batas_po_harian_idr)})`,
      aman: !breakerTerbuka
    },
    {
      risk: "Inakurasi Data Stok Gudang",
      impact: "Selisih stok fisik vs sistem ERP memicu keputusan pemesanan yang keliru.",
      mitigation: `Data Confidence Score per SKU. Di bawah ${angka((guardrail?.data_confidence_min ?? 0.8) * 100)}%, draf PO ditahan dan persetujuan ditolak sampai selisih hitung fisik diaudit.`,
      status: perluAudit.length ? `${perluAudit.length} SKU menunggu audit` : "Aktif",
      aman: perluAudit.length === 0
    },
    {
      risk: "PO Ganda & Risiko Legal",
      impact: "Network retry atau duplikasi transmisi menyebabkan pemesanan terkirim berulang ke vendor.",
      mitigation: "Idempotency-Key wajib di setiap pembuatan PO dan Hold; hanya satu draf PO per SKU; status default Draf PO (Level 2).",
      status: "Aktif",
      aman: true
    },
    {
      risk: "Prompt Injection pada LLM",
      impact: "Teks supplier atau catatan PO dipakai untuk membelokkan instruksi agent.",
      mitigation: "Agent hanya bisa bertindak lewat 6 tool REST API yang divalidasi; aturan guardrail ada di kode API, bukan di prompt; PO tetap menunggu persetujuan manusia.",
      status: "Aktif",
      aman: true
    }
  ];

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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-slate-900 tracking-tight">
                  Manajemen Risiko &amp; Failsafe Berlapis
                </h3>
                {breakerTerbuka ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                    Circuit breaker terbuka
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    5 Failsafes Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Aturan ditegakkan di API, bukan di prompt LLM: agent tidak bisa melewatinya
              </p>
            </div>
          </div>
          <button
            onClick={tutup}
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
            <span>Audit Trail</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-3.5 bg-slate-50/40">
          {pesan && (
            <div className={`text-xs font-semibold p-3 rounded-xl border ${
              pesan.galat ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {pesan.text}
            </div>
          )}

          {activeTab === 'failsafe' ? (
            <div className="space-y-3">
              {/* Circuit breaker terbuka: manajer yang menutup kembali (human-in-the-loop) */}
              {breakerTerbuka && (
                <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-red-800">
                    <AlertOctagon className="w-4 h-4 shrink-0" />
                    Semua PO baru ditahan sampai manajer mereset circuit breaker
                  </div>
                  {guardrail?.alasan && <p className="text-xs text-red-700 leading-relaxed">{guardrail.alasan}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={catatanReset}
                      onChange={(e) => setCatatanReset(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-red-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                      placeholder="Catatan pemeriksaan"
                    />
                    <button
                      disabled={mengirim}
                      onClick={() => jalankan(
                        () => api.resetBreaker(penyetuju, catatanReset || null),
                        `Circuit breaker direset oleh ${penyetuju}.`
                      )}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold disabled:opacity-60"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset circuit breaker
                    </button>
                  </div>
                </div>
              )}

              {/* Hitung fisik yang menunggu audit */}
              {stokFisik.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                    <ClipboardCheck className="w-4 h-4 shrink-0" />
                    Selisih hitung fisik menunggu audit
                  </div>
                  {stokFisik.map((c) => (
                    <div key={c.inventory_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-lg border border-amber-200 p-3">
                      <div className="text-xs">
                        <div className="font-bold text-slate-900">{c.deskripsi}</div>
                        <div className="text-slate-500 mt-0.5">
                          Sistem {angka(c.stok_sistem)} · fisik {angka(c.stok_fisik)} (selisih {angka(c.selisih)}) ·
                          Data Confidence {angka2(c.data_confidence_data)} ➔ <strong className="text-amber-800">{angka2(c.data_confidence)}</strong>
                        </div>
                      </div>
                      <button
                        disabled={mengirim}
                        onClick={() => jalankan(
                          () => api.auditStokSelesai(c.inventory_id, penyetuju),
                          `Audit ${c.deskripsi} selesai; Data Confidence kembali ${angka2(c.data_confidence_data)}.`
                        )}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold whitespace-nowrap disabled:opacity-60"
                      >
                        Audit selesai
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {failsafeList.map((item) => (
                <div
                  key={item.risk}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-[#1b4d3e] shrink-0" />
                      {item.risk}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border text-right ${
                      item.aman ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {item.aman ? '✓' : '!'} {item.status}
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
              <div className="text-xs text-slate-500 mb-2">
                Semua tindakan agent, sistem, dan manajer (50 terbaru, semua toko):
              </div>

              {!auditLog ? (
                <div className="text-xs text-slate-400 p-6 text-center">Memuat audit log...</div>
              ) : auditLog.length === 0 ? (
                <div className="text-xs text-slate-400 p-6 text-center">Belum ada tindakan yang tercatat.</div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl overflow-hidden text-xs bg-white shadow-2xs">
                  {auditLog.map((log) => {
                    const nilai = nilaiAudit(log.detail);
                    const ringkas = ringkasAudit(log);
                    return (
                      <div key={log.id} className="p-4 hover:bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">
                              {log.aksi === 'draft_purchase_order' && log.detail?.pelanggaran?.length
                                ? 'Draf PO ditahan guardrail'
                                : LABEL_AKSI[log.aksi] ?? log.aksi}
                            </span>
                            {log.resource_id && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-semibold">
                                {log.resource_id}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                            <span>oleh {log.aktor}</span>
                            {ringkas && (
                              <>
                                <span>•</span>
                                <span className="break-all">{ringkas}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          {nilai !== null && <div className="font-bold text-slate-900">{rupiah(nilai)}</div>}
                          <div className="text-[10px] text-slate-400">{waktu(log.waktu)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-white border-t border-slate-200/80 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">
            Reset circuit breaker dan audit stok selalu dilakukan manusia, tidak pernah otomatis.
          </span>
          <button
            onClick={tutup}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
