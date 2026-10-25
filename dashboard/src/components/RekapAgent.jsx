import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Download,
  Printer,
  Bot,
  PauseCircle,
  FileText,
  CheckCircle2,
  XCircle,
  ShieldAlert
} from 'lucide-react';
import { api } from '../lib/api';
import { angka, rupiah, rupiahRingkas, tanggal, waktu } from '../lib/format';

// "Bedrock au.anthropic.claude-sonnet-4-6 (ap-southeast-2)" -> "anthropic.claude-sonnet-4-6"
const namaModel = (m) => (m || '-').replace(/^(Bedrock|Ollama)\s+/, '').replace(/\s*\(.*\)$/, '').replace(/^(au|global|apac|us)\./, '');
const labelHari = (h) => (h.hari_ke == null ? 'Sebelum rekap per hari dicatat' : `${tanggal(h.tanggal)} · hari +${h.hari_ke}`);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const KOLOM_CSV = [
  ['tanggal_simulasi', (h) => h.tanggal ?? ''],
  ['hari_ke', (h) => h.hari_ke ?? ''],
  ['run_agent', (h) => h.run.length],
  ['run_gagal', (h) => h.run.filter((r) => r.status === 'GAGAL').length],
  ['hold_reorder', (h) => h.hold.length],
  ['modal_diselamatkan_idr', (h) => Math.round(h.modal_diselamatkan_idr)],
  ['draf_po', (h) => h.po_dibuat.length],
  ['nilai_draf_idr', (h) => Math.round(h.nilai_draf_idr)],
  ['po_ditahan_guardrail', (h) => h.po_dibuat.filter((p) => p.status === 'DITAHAN_GUARDRAIL').length],
  ['po_disetujui', (h) => h.po_disetujui.length],
  ['nilai_disetujui_idr', (h) => Math.round(h.po_disetujui.reduce((t, p) => t + p.nilai_idr, 0))],
  ['po_ditolak', (h) => h.po_ditolak],
  ['token_input', (h) => h.token_input],
  ['token_output', (h) => h.token_output],
];

// Pemisah ';' supaya langsung terbaca per kolom di Excel berbahasa Indonesia.
function unduhCsv(rekap) {
  const baris = [KOLOM_CSV.map(([k]) => k).join(';'), ...rekap.hari.map((h) => KOLOM_CSV.map(([, f]) => f(h)).join(';'))];
  const blob = new Blob(['﻿' + baris.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rekap-agent-toko-${rekap.store}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Halaman cetak terpisah (tanpa sidebar dan widget), lalu dialog cetak browser: bisa "Simpan sebagai PDF".
function cetak(rekap) {
  const t = rekap.total;
  const isiHari = rekap.hari.map((h) => `
    <h2>${esc(labelHari(h))}</h2>
    <p class="ringkas">${h.run.length} run agent · ${h.hold.length} Hold Reorder (modal diselamatkan ${esc(rupiah(h.modal_diselamatkan_idr))})
      · ${h.po_dibuat.length} draf PO (${esc(rupiah(h.nilai_draf_idr))}) · ${h.po_disetujui.length} PO disetujui · ${h.po_ditolak} ditolak</p>
    ${h.run.map((r) => `<div class="run"><b>${esc(waktu(r.waktu))} · ${esc(r.status)}</b> · ${esc(namaModel(r.model))} · ${r.jumlah_langkah} tool
      · ${esc(angka(r.durasi_dtk))} dtk<pre>${esc(r.ringkasan || '')}</pre></div>`).join('')}
    <ul>
      ${h.hold.map((x) => `<li>Hold Reorder: ${esc(x.deskripsi)} (modal diselamatkan ${esc(rupiah(x.modal_diselamatkan_idr))})</li>`).join('')}
      ${h.po_dibuat.map((p) => `<li>Draf PO: ${esc(p.deskripsi)}, ${esc(angka(p.qty))} unit, ${esc(rupiah(p.nilai_idr))} (${esc(p.status)}${p.pelanggaran.length ? `: ${esc(p.pelanggaran.join(', '))}` : ''})</li>`).join('')}
      ${h.po_disetujui.map((p) => `<li>Disetujui manajer: ${esc(p.deskripsi)}, PO SAP ${esc(p.sap_po_number)}, ${esc(rupiah(p.nilai_idr))}</li>`).join('')}
    </ul>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rekap Agent Rexa - Toko ${rekap.store}</title>
    <style>body{font-family:system-ui,sans-serif;font-size:12px;color:#0f172a;margin:24px}h1{font-size:18px;margin:0}
    h2{font-size:14px;margin:18px 0 4px;border-bottom:1px solid #cbd5e1;padding-bottom:2px}.ringkas{color:#475569;margin:2px 0 6px}
    .run{margin:6px 0}pre{white-space:pre-wrap;font-family:inherit;background:#f8fafc;border:1px solid #e2e8f0;padding:6px;margin:4px 0}
    table{border-collapse:collapse;margin:10px 0}td{border:1px solid #cbd5e1;padding:4px 8px}ul{margin:4px 0;padding-left:18px}</style></head><body>
    <h1>Rekap Agent Rexa · Toko ${rekap.store}</h1><p class="ringkas">Data simulasi Bibitor · dicetak ${esc(new Date().toLocaleString('id-ID'))}</p>
    <table><tr><td>Run agent</td><td>${t.run} (${t.run_gagal} gagal)</td><td>Hold Reorder</td><td>${t.hold} (modal diselamatkan ${esc(rupiah(t.modal_diselamatkan_idr))})</td></tr>
    <tr><td>Draf PO</td><td>${t.po_dibuat} (${t.po_ditahan_guardrail} ditahan guardrail)</td><td>PO disetujui</td><td>${t.po_disetujui} (${esc(rupiah(t.nilai_disetujui_idr))}), ${t.po_ditolak} ditolak</td></tr>
    <tr><td>Token LLM</td><td colspan="3">${esc(angka(t.token_input))} masuk · ${esc(angka(t.token_output))} keluar</td></tr></table>
    ${isiHari || '<p>Belum ada aktivitas agent.</p>'}</body></html>`;
  const jendela = window.open('', '_blank');
  if (!jendela) return false;
  jendela.document.write(html);
  jendela.document.close();
  jendela.focus();
  jendela.print();
  return true;
}

function KartuTotal({ label, nilai, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs min-w-0">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums truncate">{nilai}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

function Hari({ h }) {
  const ditahan = h.po_dibuat.filter((p) => p.status === 'DITAHAN_GUARDRAIL').length;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900">
          <CalendarDays className="w-4 h-4 text-[#1b4d3e]" />
          {labelHari(h)}
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          {h.run.length > 0 && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{h.run.length} run agent</span>}
          {h.hold.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">{h.hold.length} hold</span>}
          {h.po_dibuat.length > 0 && <span className="px-2 py-0.5 rounded-full bg-[#eaf4ef] text-[#1b4d3e]">{h.po_dibuat.length} draf PO</span>}
          {ditahan > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700">{ditahan} ditahan guardrail</span>}
          {h.po_disetujui.length > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">{h.po_disetujui.length} disetujui</span>}
          {h.token_input > 0 && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{angka(h.token_input + h.token_output)} token</span>}
        </div>
      </div>

      <div className="p-5 space-y-3 text-xs">
        {h.run.map((r) => (
          <details key={r.run_id} className="rounded-xl border border-slate-200 group">
            <summary className="cursor-pointer list-none px-3.5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Bot className="w-4 h-4 text-[#1b4d3e] shrink-0" />
              <span className="font-bold text-slate-800">Run agent {waktu(r.waktu)}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${r.status === 'SELESAI' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {r.status}
              </span>
              <span className="text-slate-500">{namaModel(r.model)} · {r.jumlah_langkah} tool · {angka(r.durasi_dtk)} dtk</span>
              <span className="text-[#1b4d3e] font-semibold ml-auto group-open:hidden">Lihat ringkasan</span>
            </summary>
            <div className="px-3.5 pb-3 text-slate-600 whitespace-pre-wrap leading-relaxed border-t border-slate-100 pt-2">
              {r.ringkasan || 'Tidak ada ringkasan.'}
            </div>
          </details>
        ))}

        {(h.hold.length > 0 || h.po_dibuat.length > 0 || h.po_disetujui.length > 0 || h.po_ditolak > 0) && (
          <ul className="space-y-1.5">
            {h.hold.map((x) => (
              <li key={x.hold_id} className="flex items-start gap-2">
                <PauseCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>
                  <b>Hold Reorder</b> {x.deskripsi} · modal diselamatkan <b>{rupiah(x.modal_diselamatkan_idr)}</b>
                  {x.dibuat_oleh.startsWith('agent') ? '' : ` · oleh ${x.dibuat_oleh}`}
                </span>
              </li>
            ))}
            {h.po_dibuat.map((p) => (
              <li key={p.po_id} className="flex items-start gap-2">
                {p.status === 'DITAHAN_GUARDRAIL'
                  ? <ShieldAlert className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
                  : <FileText className="w-3.5 h-3.5 text-[#1b4d3e] mt-0.5 shrink-0" />}
                <span>
                  <b>Draf PO</b> {p.deskripsi} · {angka(p.qty)} unit · {rupiah(p.nilai_idr)} · status sekarang <b>{p.status}</b>
                  {p.pelanggaran.length > 0 && ` (${p.pelanggaran.join(', ')})`}
                  {p.dibuat_oleh.startsWith('agent') ? '' : ` · oleh ${p.dibuat_oleh}`}
                </span>
              </li>
            ))}
            {h.po_disetujui.map((p) => (
              <li key={`ok-${p.po_id}`} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>
                  <b>Disetujui manajer</b> {p.deskripsi} · PO SAP <b>{p.sap_po_number}</b> · {rupiah(p.nilai_idr)}
                </span>
              </li>
            ))}
            {h.po_ditolak > 0 && (
              <li className="flex items-start gap-2">
                <XCircle className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                <span><b>{h.po_ditolak} draf PO ditolak</b> manajer</span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RekapAgent({ store, refreshKey }) {
  const [rekap, setRekap] = useState(null);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    let aktif = true;
    api.rekap(store)
      .then((r) => { if (aktif) { setRekap(r); setGalat(null); } })
      .catch((e) => { if (aktif) setGalat(e.message); });
    return () => { aktif = false; };
  }, [store, refreshKey]);

  if (galat) {
    return <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-xs text-red-700">{galat}</div>;
  }
  if (!rekap) {
    return <div className="bg-white rounded-2xl border border-slate-200/90 h-40 animate-pulse" />;
  }
  const t = rekap.total;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">Rekap Agent · Toko {rekap.store}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dikelompokkan per hari simulasi, terbaru di atas. Jam di setiap run adalah jam nyata saat agent berjalan.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => unduhCsv(rekap)}
            disabled={rekap.hari.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> Unduh CSV
          </button>
          <button
            onClick={() => { if (!cetak(rekap)) setGalat('Jendela cetak diblokir browser. Izinkan pop-up untuk dashboard ini.'); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1b4d3e] hover:bg-[#143d31] text-white text-xs font-bold"
          >
            <Printer className="w-3.5 h-3.5 text-[#a2d2bf]" /> Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KartuTotal label="Run agent" nilai={angka(t.run)} sub={`${t.run_gagal} gagal`} />
        <KartuTotal label="Hold Reorder" nilai={angka(t.hold)} sub={`Modal diselamatkan ${rupiahRingkas(t.modal_diselamatkan_idr)}`} />
        <KartuTotal label="Draf PO" nilai={angka(t.po_dibuat)} sub={`${t.po_ditahan_guardrail} ditahan guardrail`} />
        <KartuTotal label="Disetujui manajer" nilai={angka(t.po_disetujui)} sub={`${rupiahRingkas(t.nilai_disetujui_idr)} · ${t.po_ditolak} ditolak`} />
        <KartuTotal label="Token LLM" nilai={angka(t.token_input + t.token_output)} sub={`${angka(t.token_input)} masuk · ${angka(t.token_output)} keluar`} />
      </div>

      {rekap.hari.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-10 text-center text-xs text-slate-500">
          Belum ada aktivitas agent di toko ini. Jalankan agent dari Dashboard Utama, lalu majukan waktu simulasi
          untuk melihat rekap per hari.
        </div>
      ) : (
        <div className="space-y-4">
          {rekap.hari.map((h) => <Hari key={h.hari_ke ?? 'tanpa-hari'} h={h} />)}
        </div>
      )}
    </div>
  );
}
