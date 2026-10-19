import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import ScenarioBar from './ScenarioBar';
import HealthScoreCard from './HealthScoreCard';
import KpiGrid from './KpiGrid';
import ExplorationBudgetCard from './ExplorationBudgetCard';
import CapitalReallocationCard from './CapitalReallocationCard';
import SmartReorderTable from './SmartReorderTable';
import PoApprovalModal from './PoApprovalModal';
import SuppressionDetailModal from './SuppressionDetailModal';
import GuardrailsModal from './GuardrailsModal';
import AiCopilotWidget from './AiCopilotWidget';
import { 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  ArrowRight
} from 'lucide-react';
import { initialInventory, initialKpis, sapAuditLogs } from '../data/mockData';

export default function DashboardApp({ user, onLogout }) {
  const [inventoryList, setInventoryList] = useState(initialInventory);
  const [kpis, setKpis] = useState(initialKpis);
  const [activeScenario, setActiveScenario] = useState('NORMAL');
  const [isReallocated, setIsReallocated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentBranch, setCurrentBranch] = useState('Hub Jakarta Pusat (Flagship)');
  const [autonomyLevel, setAutonomyLevel] = useState('Level 2 (Draf PO)');

  const [selectedPoItem, setSelectedPoItem] = useState(null);
  const [selectedSuppressionItem, setSelectedSuppressionItem] = useState(null);
  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // ── Scenario Simulator ──
  const applyScenario = (id) => {
    setActiveScenario(id);
    if (id === 'FAST_MOVING') {
      setInventoryList(prev => prev.map(item =>
        item.id === 'SKU-001'
          ? { 
              ...item, 
              currentStock: 22, 
              salesVelocityScore: 2.65, 
              stockoutDaysRemaining: 1.1,
              stockoutConfidence: 98.2, 
              poQuantity: 180, 
              poTotalValue: 15300000, 
              agentStatus: 'DRAFT_PO' 
            }
          : item
      ));
      setKpis(p => ({ 
        ...p, 
        healthScore: 78, 
        healthStatus: 'Waspada Stockout', 
        stockoutRate: 2.9 
      }));
      showToast({ type: 'warn', text: 'Skenario Fast-Moving: Stok SKU-001 menipis kritis — segera otorisasi draf PO SAP!' });
    } else if (id === 'SLOW_MOVING') {
      setInventoryList(prev => prev.map(item =>
        item.id === 'SKU-002'
          ? { 
              ...item, 
              salesVelocityScore: 0.15, 
              stockoutDaysRemaining: 210, 
              agentStatus: 'HOLD_REORDER' 
            }
          : item
      ));
      setKpis(p => ({ 
        ...p, 
        healthScore: 86, 
        healthStatus: 'Arus Kas Terlindungi', 
        capitalSaved: 54000000 
      }));
      showToast({ type: 'info', text: 'Skenario Slow-Moving: Suppression Engine menahan PO barang lambat, hemat modal.' });
    } else if (id === 'REALLOCATION') {
      setIsReallocated(true);
      setInventoryList(prev => prev.map(item =>
        item.id === 'SKU-001'
          ? { ...item, poQuantity: 200, agentStatus: 'DRAFT_PO' }
          : item
      ));
      setKpis(p => ({ 
        ...p, 
        healthScore: 94, 
        healthStatus: 'Sangat Prima', 
        freeCashFlow: 195000000 
      }));
      showToast({ type: 'success', text: 'Realokasi Modal Berhasil: Rp 5.5 Jt dialihkan ke SKU Fast-Moving!' });
    } else {
      handleReset();
    }
  };

  const handleReset = () => {
    setInventoryList(initialInventory);
    setKpis(initialKpis);
    setActiveScenario('NORMAL');
    setIsReallocated(false);
    showToast({ type: 'info', text: 'Kondisi operasional berhasil direset ke baseline awal.' });
  };

  const handleApplyReallocation = () => {
    setIsReallocated(true);
    applyScenario('REALLOCATION');
  };

  const handleConfirmPoApproval = (skuId, sapPoNumber, idempotencyKey) => {
    setInventoryList(prev => prev.map(item =>
      item.id === skuId
        ? { ...item, agentStatus: 'AUTO_EXECUTED', autoApprovedAt: 'Hari ini (1-Click Approved)' }
        : item
    ));

    sapAuditLogs.unshift({
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: 'Baru Saja',
      skuId,
      productName: inventoryList.find(i => i.id === skuId)?.name || 'SKU Item',
      type: '1-Click Manager Approval',
      status: 'CONFIRMED_SAP',
      sapPoNumber,
      amount: 'Terkirim ke SAP S/4HANA',
      autonomyLevel: 'Level 2'
    });

    setKpis(p => ({ 
      ...p, 
      poProcessingTimeMinutes: 1.8, 
      stockoutRate: Math.max(1.5, p.stockoutRate - 0.4) 
    }));

    setSelectedPoItem(null);
    showToast({ type: 'success', text: `Purchase Order #${sapPoNumber} sukses diterbitkan ke SAP S/4HANA!` });
  };

  const urgentCount = inventoryList.filter(i => i.agentStatus === 'DRAFT_PO').length;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans antialiased text-slate-800">
      {/* ── Toast Notifications ── */}
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

      {/* ── Main Sidebar (with genuine logo & high-contrast navigation) ── */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openGuardrailsModal={() => setIsGuardrailsOpen(true)}
        urgentCount={urgentCount}
        user={user}
        onLogout={onLogout}
      />

      {/* ── Right Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          currentBranch={currentBranch}
          setCurrentBranch={setCurrentBranch}
          autonomyLevel={autonomyLevel}
          setAutonomyLevel={setAutonomyLevel}
          openGuardrailsModal={() => setIsGuardrailsOpen(true)}
          urgentCount={urgentCount}
          activeTab={activeTab}
        />

        {/* Main Body */}
        <main className="flex-1 p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Skenario Bar */}
          <ScenarioBar
            activeScenario={activeScenario}
            setActiveScenario={applyScenario}
            onReset={handleReset}
          />

          {/* Urgent PO Alert Banner */}
          {urgentCount > 0 && activeTab === 'dashboard' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-amber-900 leading-snug">
                    {urgentCount} Produk Fast-Moving Memerlukan Otorisasi Reorder
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5 font-medium">
                    Stok diprediksi habis dalam &lt; 3 hari. Draf Purchase Order telah disiapkan oleh agen AI.
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

          {/* ── TAB 1: DASHBOARD UTAMA ── */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Row 1: Health Score (left) & Executive KPI Grid (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-5 h-full">
                  <HealthScoreCard
                    score={kpis.healthScore}
                    status={kpis.healthStatus}
                    trend={kpis.healthTrend}
                  />
                </div>
                <div className="lg:col-span-7 h-full">
                  <KpiGrid kpis={kpis} />
                </div>
              </div>

              {/* Row 2: Exploration Budget Card (left) & Capital Reallocation Recommendation (right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-4 h-full">
                  <ExplorationBudgetCard explorationBudget={kpis.explorationBudget} />
                </div>
                <div className="lg:col-span-8 h-full">
                  <CapitalReallocationCard
                    onApplyReallocation={handleApplyReallocation}
                    isReallocated={isReallocated}
                  />
                </div>
              </div>

              {/* Row 3: Smart Reorder & Predictive Stockout Table */}
              <div>
                <SmartReorderTable
                  inventoryList={inventoryList}
                  onSelectPo={item => setSelectedPoItem(item)}
                  onViewSuppression={item => setSelectedSuppressionItem(item)}
                />
              </div>
            </div>
          )}

          {/* ── TAB 2: SMART REORDER & STOK ── */}
          {activeTab === 'reorder' && (
            <div className="space-y-8">
              <SmartReorderTable
                inventoryList={inventoryList}
                onSelectPo={item => setSelectedPoItem(item)}
                onViewSuppression={item => setSelectedSuppressionItem(item)}
              />
            </div>
          )}

          {/* ── TAB 3: REALOKASI MODAL ── */}
          {activeTab === 'reallocation' && (
            <div className="space-y-8">
              <CapitalReallocationCard
                onApplyReallocation={handleApplyReallocation}
                isReallocated={isReallocated}
              />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-5 h-full">
                  <ExplorationBudgetCard explorationBudget={kpis.explorationBudget} />
                </div>
                <div className="lg:col-span-7 h-full">
                  <KpiGrid kpis={kpis} />
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Global Footer */}
        <footer className="py-5 px-8 text-xs text-slate-400 border-t border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-4 mt-auto">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-slate-700">Rexa Inventory &amp; Cash Flow Copilot</span>
            <span className="text-slate-300">&bull;</span>
            <span>Agentic AI Hackathon 2026</span>
          </div>
          <div className="flex items-center gap-3 font-medium">
            <span>Infrastruktur: AWS Bedrock &amp; SageMaker</span>
            <span className="text-slate-300">&bull;</span>
            <span>Integrasi ERP: SAP BTP S/4HANA OData</span>
          </div>
        </footer>
      </div>

      {/* ── AI Operational Assistant (Slide-over Chatbot Copilot) ── */}
      <AiCopilotWidget inventoryList={inventoryList} kpis={kpis} />

      {/* ── Modals ── */}
      <PoApprovalModal
        skuItem={selectedPoItem}
        onClose={() => setSelectedPoItem(null)}
        onConfirmApproval={handleConfirmPoApproval}
      />

      <SuppressionDetailModal
        item={selectedSuppressionItem}
        onClose={() => setSelectedSuppressionItem(null)}
      />

      <GuardrailsModal
        isOpen={isGuardrailsOpen}
        onClose={() => setIsGuardrailsOpen(false)}
      />
    </div>
  );
}
