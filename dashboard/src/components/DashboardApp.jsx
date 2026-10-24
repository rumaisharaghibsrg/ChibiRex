import React, { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TopKeyMetricsRow from './TopKeyMetricsRow';
import ExplorationBudgetCard from './ExplorationBudgetCard';
import CapitalReallocationCard from './CapitalReallocationCard';
import SmartReorderTable from './SmartReorderTable';
import PoApprovalModal from './PoApprovalModal';
import SuppressionDetailModal from './SuppressionDetailModal';
import GuardrailsModal from './GuardrailsModal';
import AiCopilotWidget from './AiCopilotWidget';
import AgentRunPanel from './AgentRunPanel';
import PendingPoCard from './PendingPoCard';
import KpiGrid from './KpiGrid';
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { api } from '../lib/api';
import { rupiah, tanggal } from '../lib/format';
import { RASIO_BORONGAN, simulasiSelisihStok, ujiRunawayPo } from '../lib/skenario';
import { useDataToko } from '../lib/useDataToko';

// Toko demo (Bibitor toko 74): SKU demo Bacardi Gold Rum (draf PO) dan Ciroc Apple Vodka (Hold Reorder).
const DEMO_STORE = 74;

export default function DashboardApp({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [store, setStore] = useState(DEMO_STORE);
  const [stores, setStores] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // naik setiap ada aksi agent/manajer, memicu muat ulang data API
  const [selectedSuppressionItem, setSelectedSuppressionItem] = useState(null);
  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState(false);
  const [skenarioBerjalan, setSkenarioBerjalan] = useState(null);
  const [toast, setToast] = useState(null);

  const { data, error, memuat } = useDataToko(store, refreshKey);
  const penyetuju = user?.name || 'Manajer toko';

  useEffect(() => {
    api.stores().then(setStores).catch(() => setStores([]));
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  const muatUlang = useCallback(() => setRefreshKey(k => k + 1), []);

  // ── Jam simulasi: setiap hari simulasi berganti (tombol, mode otomatis, atau dari tab lain), data dimuat ulang ──
  const [sim, setSim] = useState(null);
  const hariSimRef = useRef(null);
  const terimaSim = useCallback((s) => {
    setSim(s);
    if (hariSimRef.current !== null && hariSimRef.current !== s.hari_ke) muatUlang();
    hariSimRef.current = s.hari_ke;
  }, [muatUlang]);

  const simOtomatis = Boolean(sim?.otomatis);
  const detikPerHari = sim?.detik_per_hari ?? 60;
  useEffect(() => {
    let aktif = true;
    const cek = () => api.simulasi().then((s) => aktif && terimaSim(s)).catch(() => {});
    cek();
    // Mode otomatis dicek lebih sering supaya pergantian hari cepat terlihat.
    const ulang = setInterval(cek, simOtomatis ? Math.min(5000, detikPerHari * 500) : 15000);
    return () => {
      aktif = false;
      clearInterval(ulang);
    };
  }, [terimaSim, simOtomatis, detikPerHari]);

  const handleMajuSimulasi = async (hari) => {
    try {
      const s = await api.majuSimulasi(hari, penyetuju);
      terimaSim(s);
      showToast({ type: 'info', text: `Waktu simulasi maju ke ${tanggal(s.tanggal)} (hari +${s.hari_ke}).` });
    } catch (e) {
      showToast({ type: 'warn', text: e.message });
    }
  };

  const handleOtomatisSimulasi = async (aktif, detik) => {
    try {
      const s = await api.otomatisSimulasi(aktif, detik, penyetuju);
      terimaSim(s);
      showToast({
        type: 'info',
        text: aktif ? `Waktu simulasi berjalan otomatis: 1 hari tiap ${s.detik_per_hari} detik.` : 'Waktu simulasi dijeda.',
      });
    } catch (e) {
      showToast({ type: 'warn', text: e.message });
    }
  };

  const handleAgentSelesai = useCallback((run) => {
    muatUlang();
    showToast(run.status === 'SELESAI'
      ? { type: 'success', text: 'Agent selesai. Tinjau draf PO yang menunggu persetujuan.' }
      : { type: 'warn', text: 'Agent gagal. Lihat pesan di panel agent.' });
  }, [muatUlang]);

  const handlePoDiputuskan = (po) => {
    muatUlang();
    showToast(po.status === 'APPROVED'
      ? { type: 'success', text: `PO SAP #${po.sap_po_number} dibuat untuk ${po.deskripsi}.` }
      : { type: 'info', text: `Draf PO ${po.deskripsi} ditolak; tidak ada yang dikirim ke SAP.` });
  };

  // ── Skenario uji guardrail (data asli lewat API) ──
  const breakerTerbuka = Boolean(data?.guardrail?.circuit_breaker_terbuka);
  const stokFisik = data?.stokFisik ?? [];
  const skenario = [
    {
      id: 'RUNAWAY',
      label: 'Uji Runaway PO',
      desc: breakerTerbuka
        ? 'Circuit breaker sudah terbuka; reset dulu di Audit & Guardrails.'
        : `3 PO dengan lonjakan borongan ${RASIO_BORONGAN}x (median Online Retail II) ditahan guardrail 3σ, lalu circuit breaker terbuka.`,
      disabled: breakerTerbuka || !data
    },
    {
      id: 'SELISIH',
      label: 'Simulasi selisih stok',
      desc: stokFisik.length
        ? 'Sudah ada hitung fisik yang menunggu audit.'
        : 'Hitung fisik SKU prioritas 25% lebih kecil: Data Confidence turun, PO SKU itu ditahan.',
      disabled: stokFisik.length > 0 || !data
    },
    {
      id: 'AUDIT',
      label: 'Audit stok selesai',
      desc: stokFisik.length
        ? `${stokFisik.length} hitung fisik menunggu audit manajer.`
        : 'Tidak ada hitung fisik yang menunggu audit.',
      disabled: stokFisik.length === 0
    },
    {
      id: 'GUARDRAIL',
      label: 'Reset circuit breaker (manajer)',
      desc: breakerTerbuka ? 'Buka Audit & Guardrails untuk mereset.' : 'Circuit breaker sedang tertutup.',
      disabled: !breakerTerbuka
    }
  ];

  const handleSkenario = async (id) => {
    if (id === 'GUARDRAIL') {
      setIsGuardrailsOpen(true);
      return;
    }
    setSkenarioBerjalan(id);
    try {
      if (id === 'RUNAWAY') {
        const po = await ujiRunawayPo(store);
        const ditahan = po.filter((p) => p.status === 'DITAHAN_GUARDRAIL').length;
        showToast({ type: 'warn', text: `Runaway PO: ${ditahan} dari ${po.length} PO ditahan guardrail. Reset circuit breaker setelah diperiksa.` });
        setIsGuardrailsOpen(true);
      } else if (id === 'SELISIH') {
        const hasil = await simulasiSelisihStok(store, penyetuju);
        showToast({ type: 'warn', text: `${hasil.deskripsi}: hitung fisik ${hasil.stok_fisik} vs sistem ${hasil.stok_sistem}. Jalankan agent untuk melihat PO-nya ditahan.` });
      } else if (id === 'AUDIT') {
        for (const c of stokFisik) await api.auditStokSelesai(c.inventory_id, penyetuju);
        showToast({ type: 'success', text: 'Audit stok selesai; Data Confidence kembali normal.' });
      }
    } catch (e) {
      showToast({ type: 'warn', text: e.message });
    } finally {
      setSkenarioBerjalan(null);
      muatUlang();
    }
  };

  const ringkasan = data?.ringkasan ?? null;
  const holdsAktif = (data?.holds ?? []).filter((h) => h.status === 'AKTIF');
  const urgentCount = ringkasan?.po_menunggu ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans antialiased text-slate-800">
      {/* ── Toast Notifications (Quiet & Minimal) ── */}
      {toast && (() => {
        const isWarn = toast.type === 'warn';
        const isInfo = toast.type === 'info';
        const IconComp = isWarn ? AlertTriangle : isInfo ? Info : CheckCircle;
        const bgColor = isWarn ? 'bg-amber-800' : isInfo ? 'bg-slate-800' : 'bg-[#1b4d3e]';
        const iconColor = isWarn ? 'text-amber-300' : isInfo ? 'text-slate-300' : 'text-[#a2d2bf]';
        return (
          <div className={`fixed top-5 right-5 z-50 ${bgColor} text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold max-w-sm border border-white/10 animate-in fade-in slide-in-from-top-3`}>
            <IconComp className={`w-5 h-5 shrink-0 ${iconColor}`} />
            <span>{toast.text}</span>
          </div>
        );
      })()}

      {/* ── Main Sidebar ── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openGuardrailsModal={() => setIsGuardrailsOpen(true)}
        urgentCount={urgentCount}
        modalDiselamatkan={ringkasan?.modal_diselamatkan_idr ?? 0}
        explorationBudget={ringkasan?.exploration_budget_idr ?? 0}
        jumlahHold={holdsAktif.length}
        breakerTerbuka={breakerTerbuka}
        user={user}
        onLogout={onLogout}
      />

      {/* ── Right Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header: pilihan toko, level otonomi, skenario uji */}
        <Header
          stores={stores}
          store={store}
          setStore={setStore}
          sim={sim}
          onMajuSimulasi={handleMajuSimulasi}
          onOtomatisSimulasi={handleOtomatisSimulasi}
          apiOk={!error}
          activeTab={activeTab}
          skenario={skenario}
          onSkenario={handleSkenario}
          skenarioBerjalan={skenarioBerjalan}
        />

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full min-w-0">
          {/* API tidak terjangkau */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-extrabold text-red-900">Data toko gagal dimuat</h4>
                  <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{error.message}</p>
                </div>
              </div>
              <button
                onClick={muatUlang}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${memuat ? 'animate-spin' : ''}`} />
                Coba lagi
              </button>
            </div>
          )}

          {/* ── TAB 1: DASHBOARD UTAMA ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 sm:space-y-8">
              {/* Row 1: Key Metric Cards (Inventory Health, Modal Terselamatkan, Risiko Stok Habis) */}
              <TopKeyMetricsRow ringkasan={ringkasan} jumlahHold={holdsAktif.length} />

              {/* Draf PO menunggu 1-Click Approval */}
              {urgentCount > 0 && (
                <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-amber-900 leading-snug">
                        {urgentCount} Draf PO Menunggu 1-Click Approval
                      </h4>
                      <p className="text-xs text-amber-700 mt-0.5 font-medium">
                        Disusun agent Rexa, total {rupiah(ringkasan.nilai_po_menunggu_idr)}. Tidak ada yang dikirim ke SAP sebelum Anda setujui.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('reorder')}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <span>Buka Smart Reorder</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Row 2: Agent Rexa (data API) & Draf PO yang Menunggu 1-Click Approval */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-8 h-full">
                  <AgentRunPanel store={store} onSelesai={handleAgentSelesai} onBukaPo={setSelectedPoId} />
                </div>
                <div className="lg:col-span-4 h-full">
                  <PendingPoCard store={store} refreshKey={refreshKey} tanggalSim={sim?.tanggal} onBukaPo={setSelectedPoId} />
                </div>
              </div>

              {/* Row 3: Exploration Budget Card (left) & Capital Reallocation Recommendation (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-4 h-full">
                  <ExplorationBudgetCard holds={data?.holds} />
                </div>
                <div className="lg:col-span-8 h-full">
                  <CapitalReallocationCard
                    realokasi={data?.realokasi}
                    poList={data?.poList}
                    onBukaPo={setSelectedPoId}
                  />
                </div>
              </div>

              {/* Row 4: Smart Reorder & Predictive Stockout Table */}
              <div>
                <SmartReorderTable
                  baris={data?.baris}
                  memuat={memuat}
                  batas={8}
                  onLihatSemua={() => setActiveTab('reorder')}
                  onSelectPo={setSelectedPoId}
                  onViewSuppression={setSelectedSuppressionItem}
                />
              </div>
            </div>
          )}

          {/* ── TAB 2: SMART REORDER & STOK ── */}
          {activeTab === 'reorder' && (
            <div className="space-y-8">
              <PendingPoCard store={store} refreshKey={refreshKey} tanggalSim={sim?.tanggal} onBukaPo={setSelectedPoId} />
              <SmartReorderTable
                baris={data?.baris}
                memuat={memuat}
                onSelectPo={setSelectedPoId}
                onViewSuppression={setSelectedSuppressionItem}
              />
            </div>
          )}

          {/* ── TAB 3: REALOKASI MODAL ── */}
          {activeTab === 'reallocation' && (
            <div className="space-y-8">
              <CapitalReallocationCard
                realokasi={data?.realokasi}
                poList={data?.poList}
                onBukaPo={setSelectedPoId}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-5 h-full">
                  <ExplorationBudgetCard holds={data?.holds} />
                </div>
                <div className="lg:col-span-7 h-full">
                  <KpiGrid ringkasan={ringkasan} jumlahHold={holdsAktif.length} />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Global Footer */}
        <footer className="py-4 sm:py-5 px-4 sm:px-8 text-xs text-slate-400 border-t border-slate-200/80 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-auto">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-extrabold text-slate-700">Rexa Inventory &amp; Cash Flow Copilot</span>
            <span className="text-slate-300 hidden sm:inline">&bull;</span>
            <span>Agentic AI Hackathon 2026</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-medium">
            <span>Agent: Strands Agents + LLM (Ollama qwen3)</span>
            <span className="text-slate-300 hidden sm:inline">&bull;</span>
            <span>ERP: tiruan SAP S/4HANA (OData)</span>
            <span className="text-slate-300 hidden sm:inline">&bull;</span>
            <span>Data simulasi: Bibitor per 31 Des 2016</span>
          </div>
        </footer>
      </div>

      {/* ── Copilot (jawaban dari data API) ── */}
      <AiCopilotWidget data={data} />

      {/* ── Modals ── */}
      <PoApprovalModal
        key={selectedPoId}
        poId={selectedPoId}
        penyetuju={penyetuju}
        onClose={() => setSelectedPoId(null)}
        onSelesai={handlePoDiputuskan}
      />

      <SuppressionDetailModal
        key={selectedSuppressionItem?.sku.inventory_id}
        item={selectedSuppressionItem}
        onClose={() => setSelectedSuppressionItem(null)}
      />

      <GuardrailsModal
        isOpen={isGuardrailsOpen}
        onClose={() => setIsGuardrailsOpen(false)}
        guardrail={data?.guardrail}
        stokFisik={stokFisik}
        jumlahHold={holdsAktif.length}
        penyetuju={penyetuju}
        onBerubah={muatUlang}
      />
    </div>
  );
}
