import React, { useEffect, useMemo, useState } from 'react';
import {
  Network,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Search,
  Truck,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Gamepad2
} from 'lucide-react';
import { api, COPILOT_URL, VIRTUAL_HQ_URL } from '../lib/api';
import { angka, rupiah, rupiahRingkas, tanggal, waktu } from '../lib/format';

// Ambang warna sama dengan HealthScoreCard di dashboard toko.
const statusHealth = (skor) => {
  if (skor >= 80) return { label: 'Sehat', warna: '#1b4d3e', badge: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  if (skor >= 65) return { label: 'Perlu perhatian', warna: '#d97706', badge: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: 'Kritis', warna: '#dc2626', badge: 'bg-red-50 text-red-800 border-red-200' };
};

const KUNCI_LAPORAN = 'rexa.laporanJaringan.v1';

function bacaLaporan() {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_LAPORAN)) || null;
  } catch {
    return null;
  }
}

function simpanLaporan(laporan) {
  try {
    localStorage.setItem(KUNCI_LAPORAN, JSON.stringify(laporan));
  } catch {
    // Penyimpanan browser tidak tersedia (mode privat); laporan tetap tampil sampai halaman ditutup.
  }
}

function BadgeHealth({ skor }) {
  const s = statusHealth(skor);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${s.badge}`}>
      {skor}<span className="font-semibold">· {s.label}</span>
    </span>
  );
}

function KartuTotal({ label, nilai, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs min-w-0">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-extrabold text-slate-900 mt-1 truncate">{nilai}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

// ── Agent jaringan: Claude di Lambda Copilot membaca semua toko lalu menetapkan prioritas (hanya membaca) ──

const labelLangkah = (l) => {
  switch (l.alat) {
    case 'ringkasan_jaringan': return `Ringkasan jaringan · urut ${(l.masukan?.urut || 'health_score').replace(/_/g, ' ')}`;
    case 'detail_toko': return `Detail toko ${l.masukan?.store}`;
    case 'peluang_transfer': return 'Peluang transfer stok';
    case 'tetapkan_prioritas': return 'Tetapkan prioritas';
    default: return l.alat;
  }
};

function AgentJaringan({ perTanggal, onBuka }) {
  const [laporan, setLaporan] = useState(bacaLaporan);
  const [berjalan, setBerjalan] = useState(false);
  const [detik, setDetik] = useState(0);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    if (!berjalan) return undefined;
    const mulai = Date.now();
    const ulang = setInterval(() => setDetik(Math.round((Date.now() - mulai) / 1000)), 1000);
    return () => clearInterval(ulang);
  }, [berjalan]);

  const jalankan = async () => {
    setBerjalan(true);
    setDetik(0);
    setGalat(null);
    try {
      const hasil = { ...(await api.analisisJaringan('id')), dibuat_pada: new Date().toISOString() };
      setLaporan(hasil);
      simpanLaporan(hasil);
    } catch (e) {
      setGalat(e.message);
    } finally {
      setBerjalan(false);
    }
  };

  const usang = laporan && perTanggal && laporan.per_tanggal !== perTanggal;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="p-6 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1b4d3e] flex items-center justify-center shrink-0">
            <Network className="w-5 h-5 text-[#a2d2bf]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug">Agent Jaringan</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Memeriksa semua toko sekaligus: toko paling kritis beserta alasannya dan transfer stok antar toko.
              Hanya membaca; PO tetap dibuat agent toko dan disetujui manajer.
            </p>
          </div>
        </div>
        <button
          onClick={jalankan}
          disabled={berjalan || !COPILOT_URL}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-[#1b4d3e] hover:bg-[#143d31] disabled:opacity-60 disabled:cursor-not-allowed text-white shadow-sm transition-all active:scale-95 whitespace-nowrap"
        >
          {berjalan ? (
            <>
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              <span>Menganalisis ({detik} dtk)</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#a2d2bf]" />
              <span>{laporan ? 'Analisis Lagi' : 'Analisis Semua Toko'}</span>
            </>
          )}
        </button>
      </div>

      <div className="p-6 space-y-5 text-xs">
        {!COPILOT_URL && (
          <p className="text-slate-500">
            Agent jaringan berjalan di Lambda Copilot (Claude di Amazon Bedrock), yang belum diatur untuk dashboard ini
            (VITE_COPILOT_URL). Statistik semua toko di bawah tetap bisa dipakai.
          </p>
        )}
        {berjalan && (
          <p className="text-slate-600 leading-relaxed">
            Agent membaca statistik semua toko, membuka detail toko yang paling bermasalah, lalu mencari stok berlebih
            di toko lain yang bisa menggantikan PO baru. Biasanya 20-40 detik.
          </p>
        )}
        {galat && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{galat}</span>
          </div>
        )}
        {!laporan && !berjalan && COPILOT_URL && (
          <p className="text-slate-500">
            Tekan <strong>Analisis Semua Toko</strong>. Agent di dashboard toko memeriksa satu toko; agent ini
            membandingkan semua toko dan menyarankan toko mana yang perlu ditangani dulu.
          </p>
        )}

        {laporan && (
          <div className={`space-y-5 transition-opacity ${berjalan ? 'opacity-50' : ''}`}>
            {usang && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Laporan ini untuk data {tanggal(laporan.per_tanggal)}, sedangkan tanggal simulasi sekarang
                  {' '}{tanggal(perTanggal)}. Jalankan analisis lagi untuk data terbaru.
                </span>
              </div>
            )}
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{laporan.ringkasan}</p>

            {laporan.toko.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Toko prioritas</div>
                {laporan.toko.map((t, i) => (
                  <div key={t.store} className="rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-extrabold shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900">Toko {t.store} · {t.kota}</span>
                        <BadgeHealth skor={t.health_score} />
                        <span className="text-slate-500">
                          {angka(t.perlu_reorder)} perlu reorder · {angka(t.sku_risiko_tinggi)} risiko tinggi ·
                          modal tertahan {rupiahRingkas(t.modal_tertahan_idr)}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{t.alasan}</p>
                      <p className="text-[#1b4d3e] font-semibold leading-relaxed flex items-start gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{t.tindakan}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onBuka(t.store)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 whitespace-nowrap self-start"
                    >
                      Buka toko <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {laporan.transfer.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Transfer yang disarankan</div>
                {laporan.transfer.map((t) => (
                  <div key={t.ke_inventory_id} className="rounded-xl border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-start gap-3">
                    <Truck className="w-4 h-4 text-[#1b4d3e] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-bold text-slate-900">
                        {t.deskripsi}: toko {t.dari_toko} → toko {t.ke_toko}, {angka(t.qty)} unit
                        <span className="text-[#1b4d3e]"> · PO dihindari {rupiah(t.nilai_idr)}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{t.alasan}</p>
                    </div>
                    <button
                      onClick={() => onBuka(t.ke_toko)}
                      className="text-[#1b4d3e] font-bold hover:underline whitespace-nowrap self-start"
                    >
                      Buka toko {t.ke_toko}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {laporan.langkah.map((l, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                  {i + 1}. {labelLangkah(l)}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              {laporan.model?.replace(/^(au|global|apac|us)\./, '')} · {laporan.langkah.length} langkah ·
              {' '}{angka(laporan.durasi_dtk)} dtk · {angka(laporan.token_input + laporan.token_output)} token ·
              data {tanggal(laporan.per_tanggal)} · dijalankan {waktu(laporan.dibuat_pada)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Grafik Health Score semua toko (urut dari terendah); tabel di bawahnya memuat angka yang sama ──

function GrafikHealth({ toko, onBuka }) {
  const [sorot, setSorot] = useState(null);
  const urut = useMemo(() => [...toko].sort((a, b) => a.health_score - b.health_score || a.store - b.store), [toko]);
  const jumlah = (f) => toko.filter(f).length;
  const legenda = [
    { ...statusHealth(0), teks: '< 65', n: jumlah((t) => t.health_score < 65) },
    { ...statusHealth(70), teks: '65-79', n: jumlah((t) => t.health_score >= 65 && t.health_score < 80) },
    { ...statusHealth(90), teks: '≥ 80', n: jumlah((t) => t.health_score >= 80) },
  ];
  const t = sorot === null ? null : urut[sorot];
  const posisi = sorot === null ? 0 : ((sorot + 0.5) / urut.length) * 100;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Health Score per toko</h3>
          <p className="text-xs text-slate-500 mt-0.5">{toko.length} toko, urut dari yang terendah. Klik batang untuk membuka tokonya.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-semibold">
          {legenda.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.warna }} />
              {l.label} {l.teks} <span className="text-slate-400">({l.n} toko)</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-[10px] text-slate-400 tabular-nums h-40 -mt-1.5 pb-0 text-right w-6 shrink-0">
          <span>100</span><span>50</span><span>0</span>
        </div>
        <div className="relative flex-1 h-40" onMouseLeave={() => setSorot(null)}>
          {[0, 50, 100].map((g) => (
            <div key={g} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${g}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {urut.map((x, i) => (
              <button
                key={x.store}
                onClick={() => onBuka(x.store)}
                onMouseEnter={() => setSorot(i)}
                onFocus={() => setSorot(i)}
                onBlur={() => setSorot(null)}
                aria-label={`Toko ${x.store} ${x.kota}, Health Score ${x.health_score}`}
                className={`h-full flex-1 min-w-0 flex items-end px-px focus:outline-none ${sorot === i ? 'bg-slate-100/80' : ''}`}
              >
                <span
                  className="block w-full rounded-t-[4px]"
                  style={{ height: `${x.health_score}%`, background: statusHealth(x.health_score).warna, opacity: sorot === null || sorot === i ? 1 : 0.55 }}
                />
              </button>
            ))}
          </div>
          {t && (
            <div
              className="absolute -top-2 pointer-events-none z-10 bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg"
              style={{ left: `${posisi}%`, transform: `translate(${posisi < 15 ? '0' : posisi > 85 ? '-100%' : '-50%'}, -100%)` }}
            >
              <div className="font-bold">Toko {t.store} · {t.kota}</div>
              <div className="text-slate-300">Health {t.health_score} · {angka(t.perlu_reorder)} perlu reorder · tertahan {rupiahRingkas(t.modal_tertahan_idr)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tabel semua toko, bisa diurutkan dan dicari ──

const KOLOM = [
  { key: 'health_score', label: 'Health', isi: (t) => <BadgeHealth skor={t.health_score} /> },
  { key: 'ketersediaan', label: 'Ketersediaan', isi: (t) => angka(t.ketersediaan) },
  { key: 'perputaran', label: 'Perputaran', isi: (t) => angka(t.perputaran) },
  { key: 'stabilitas_kas', label: 'Stabilitas kas', isi: (t) => angka(t.stabilitas_kas) },
  { key: 'perlu_reorder', label: 'Perlu reorder', isi: (t) => angka(t.perlu_reorder) },
  { key: 'sku_risiko_tinggi', label: 'Risiko tinggi', isi: (t) => angka(t.sku_risiko_tinggi) },
  { key: 'overstock', label: 'Overstock', isi: (t) => angka(t.overstock) },
  { key: 'deadstock', label: 'Deadstock', isi: (t) => angka(t.deadstock) },
  { key: 'modal_tertahan_idr', label: 'Modal tertahan', isi: (t) => rupiahRingkas(t.modal_tertahan_idr) },
  { key: 'po_menunggu', label: 'Draf PO', isi: (t) => (t.po_menunggu ? `${t.po_menunggu} · ${rupiahRingkas(t.nilai_po_menunggu_idr)}` : '-') },
  { key: 'hold_aktif', label: 'Hold', isi: (t) => (t.hold_aktif ? angka(t.hold_aktif) : '-') },
];

function TabelToko({ toko, onBuka }) {
  const [urut, setUrut] = useState({ key: 'health_score', naik: true });
  const [cari, setCari] = useState('');

  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const cocok = q ? toko.filter((t) => String(t.store) === q || t.kota.toLowerCase().includes(q)) : toko;
    const arah = urut.naik ? 1 : -1;
    return [...cocok].sort((a, b) => (a[urut.key] - b[urut.key]) * arah || a.store - b.store);
  }, [toko, urut, cari]);

  const klikKolom = (key) => setUrut((u) => (u.key === key ? { key, naik: !u.naik } : { key, naik: key === 'health_score' || key === 'store' }));
  const Panah = urut.naik ? ArrowUp : ArrowDown;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Semua toko</h3>
          <p className="text-xs text-slate-500 mt-0.5">Klik judul kolom untuk mengurutkan, klik baris untuk membuka dashboard toko itu.</p>
        </div>
        <label className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Nomor toko atau kota"
            className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-[#1b4d3e]/20"
          />
        </label>
      </div>
      <div className="overflow-auto max-h-[560px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              {[{ key: 'store', label: 'Toko' }, ...KOLOM].map((k) => (
                <th key={k.key} className="px-3 py-2.5 font-bold whitespace-nowrap">
                  <button onClick={() => klikKolom(k.key)} className="inline-flex items-center gap-1 hover:text-slate-800 uppercase tracking-wider">
                    {k.label}
                    {urut.key === k.key && <Panah className="w-3 h-3" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {baris.map((t) => (
              <tr key={t.store} onClick={() => onBuka(t.store)} className="hover:bg-slate-50 cursor-pointer">
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <button onClick={(e) => { e.stopPropagation(); onBuka(t.store); }} className="font-bold text-slate-900 hover:text-[#1b4d3e] hover:underline">
                    Toko {t.store}
                  </button>
                  <span className="text-slate-500"> · {t.kota}</span>
                </td>
                {KOLOM.map((k) => (
                  <td key={k.key} className="px-3 py-2.5 whitespace-nowrap tabular-nums text-slate-700">{k.isi(t)}</td>
                ))}
              </tr>
            ))}
            {baris.length === 0 && (
              <tr><td colSpan={KOLOM.length + 1} className="px-3 py-8 text-center text-slate-500">Tidak ada toko yang cocok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DaftarTransfer({ data, onBuka }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#1b4d3e]" /> Peluang transfer stok antar toko
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Merek yang perlu reorder di satu toko, padahal toko lain kelebihan stok merek yang sama. Belum memperhitungkan
            jarak dan ongkos kirim.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PO yang bisa dihindari</div>
          <div className="text-base font-extrabold text-[#1b4d3e]">{rupiahRingkas(data.total_nilai_idr)}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 font-bold">Produk</th>
              <th className="px-3 py-2.5 font-bold">Dari (kelebihan)</th>
              <th className="px-3 py-2.5 font-bold">Ke (perlu reorder)</th>
              <th className="px-3 py-2.5 font-bold text-right">Qty</th>
              <th className="px-3 py-2.5 font-bold text-right">PO dihindari</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.transfer.map((t) => (
              <tr key={t.ke_inventory_id}>
                <td className="px-3 py-2.5 font-semibold text-slate-900">{t.deskripsi}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-slate-700">
                  Toko {t.dari_toko} · {t.dari_kota}
                  <span className="text-slate-400"> · {t.status_dari.toLowerCase()}, lebih {angka(t.kelebihan_unit)}</span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <button onClick={() => onBuka(t.ke_toko)} className="font-semibold text-[#1b4d3e] hover:underline">
                    Toko {t.ke_toko} · {t.ke_kota}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{angka(t.qty)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">{rupiah(t.nilai_idr)}</td>
              </tr>
            ))}
            {data.transfer.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Tidak ada peluang transfer pada tanggal ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function JaringanToko({ refreshKey, onBukaToko }) {
  const [data, setData] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [galat, setGalat] = useState(null);
  const [ulang, setUlang] = useState(0);
  // Memuat selama permintaan untuk kunci ini belum selesai; data lama tetap tampil (redup) selama itu.
  const kunci = `${refreshKey}:${ulang}`;
  const [kunciSelesai, setKunciSelesai] = useState(null);
  const memuat = kunciSelesai !== kunci;

  useEffect(() => {
    let aktif = true;
    Promise.all([api.jaringan(), api.transferJaringan(20)])
      .then(([r, t]) => { if (aktif) { setData(r); setTransfer(t); setGalat(null); } })
      .catch((e) => { if (aktif) setGalat(e.message); })
      .finally(() => { if (aktif) setKunciSelesai(kunci); });
    return () => { aktif = false; };
  }, [kunci]);

  if (galat && !data) {
    return <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-xs text-red-700">{galat}</div>;
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="bg-white rounded-2xl border border-slate-200/90 h-[86px] animate-pulse" />)}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/90 h-64 animate-pulse" />
      </div>
    );
  }

  const kritis = data.toko.filter((t) => t.health_score < 65);
  const terendah = data.toko.reduce((a, b) => (b.health_score < a.health_score ? b : a), data.toko[0] ?? { health_score: 100 });

  return (
    <div className={`space-y-6 sm:space-y-8 transition-opacity ${memuat ? 'opacity-60' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Data simulasi {tanggal(data.per_tanggal)} (hari +{data.hari_ke}) · {data.jumlah_toko} toko Bibitor. Angka per toko
          sama dengan dashboard tokonya.
        </p>
        <div className="flex gap-2 self-start">
          <a
            href={`${VIRTUAL_HQ_URL}?mode=jaringan`}
            title="Buka Virtual HQ mode Semua Toko: staf melapor untuk seluruh jaringan dan Rexa menjalankan Agent Jaringan"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] hover:from-[#1e293b] hover:to-[#1e4976] text-xs font-bold text-white"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-sky-300" /> Buka di Virtual HQ
          </a>
          <button
            onClick={() => setUlang((u) => u + 1)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${memuat ? 'animate-spin' : ''}`} /> Muat ulang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KartuTotal label="Health rata-rata" nilai={angka(data.health_rata)} sub={`dari ${data.jumlah_toko} toko`} />
        <KartuTotal
          label="Toko kritis"
          nilai={angka(kritis.length)}
          sub={terendah.health_score < 65 ? `Terendah toko ${terendah.store} · ${terendah.health_score}` : 'Semua toko ≥ 65'}
        />
        <KartuTotal label="SKU perlu reorder" nilai={angka(data.perlu_reorder)} sub={`${angka(data.sku_risiko_tinggi)} risiko tinggi`} />
        <KartuTotal label="Modal tertahan" nilai={rupiahRingkas(data.modal_tertahan_idr)} sub={`dari stok ${rupiahRingkas(data.nilai_stok_idr)}`} />
        <KartuTotal label="Draf PO menunggu" nilai={angka(data.po_menunggu)} sub={rupiahRingkas(data.nilai_po_menunggu_idr)} />
        <KartuTotal
          label="Peluang transfer"
          nilai={rupiahRingkas(transfer?.total_nilai_idr ?? 0)}
          sub={`${transfer?.transfer.length ?? 0} transfer teratas`}
        />
      </div>

      <AgentJaringan perTanggal={data.per_tanggal} onBuka={onBukaToko} />
      <GrafikHealth toko={data.toko} onBuka={onBukaToko} />
      <TabelToko toko={data.toko} onBuka={onBukaToko} />
      {transfer && <DaftarTransfer data={transfer} onBuka={onBukaToko} />}
    </div>
  );
}
