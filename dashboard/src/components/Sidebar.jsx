import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ArrowRightLeft, 
  ShieldCheck, 
  Compass, 
  LogOut, 
  CheckCircle2,
  AlertOctagon,
  CalendarDays,
  Network,
  Gamepad2
} from 'lucide-react';
import { rupiahRingkas } from '../lib/format';

export default function Sidebar({
  activeTab,
  setActiveTab,
  openGuardrailsModal,
  urgentCount = 0,
  modalDiselamatkan = 0,
  explorationBudget = 0,
  jumlahHold = 0,
  breakerTerbuka = false,
  virtualHqUrl,
  virtualHqSemua = false,
  user,
  onLogout
}) {
  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard Utama",
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: "jaringan",
      label: "Semua Toko",
      icon: Network,
      badge: null
    },
    {
      id: "reorder",
      label: "Smart Reorder & Stok",
      icon: ShoppingCart,
      badge: urgentCount > 0 ? `${urgentCount} Draft` : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: "reallocation",
      label: "Realokasi Modal",
      icon: ArrowRightLeft,
      badge: modalDiselamatkan > 0 ? rupiahRingkas(modalDiselamatkan) : null,
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      id: "rekap",
      label: "Rekap Agent",
      icon: CalendarDays,
      badge: null
    }
  ];

  // Status guardrail: merah selama circuit breaker terbuka (menunggu reset manajer).
  const guardrailBadge = breakerTerbuka
    ? { text: 'Breaker terbuka', className: 'text-red-700 bg-red-50 border-red-200' }
    : { text: 'Aktif', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  const GuardrailIcon = breakerTerbuka ? AlertOctagon : ShieldCheck;

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 lg:h-screen lg:sticky lg:top-0 flex flex-col select-none z-20 shadow-xs overflow-x-hidden">
      {/* Brand Header — Real Logo (Pinned at top) */}
      <div className="h-16 lg:h-20 px-4 sm:px-6 flex items-center justify-between border-b border-slate-100 bg-white shrink-0">
        <img 
          src="/rexa-logo-transparent.png" 
          alt="Rexa - Inventory & Cash Flow Copilot" 
          className="h-10 lg:h-12 w-auto max-w-[150px] sm:max-w-[185px] object-contain"
          loading="eager"
        />

        {/* User profile + Logout compact untuk layar HP/Tablet */}
        <div className="flex lg:hidden items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#1b4d3e] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'R'}
          </div>
          <button
            onClick={onLogout}
            title="Keluar"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Container: overflow-y-auto vertikal independen, overflow-x-hidden mutlak tanpa pergeseran horizontal, pb-4 proporsional */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col pb-4">
        <div className="flex flex-col">
          {/* User / Organization Profile (Desktop) */}
          <div className="hidden lg:flex mx-3.5 mt-4 mb-2 p-3 bg-slate-50 border border-slate-200/70 rounded-xl items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[#1b4d3e] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'R'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {user?.name || 'Manager Operasional'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {user?.business || 'Retail Nusantara Group'}
              </p>
            </div>
          </div>

          {/* Navigation Section */}
          <div className="p-2 sm:p-3 lg:px-3 space-y-2 lg:space-y-4">
            {/* Main Links */}
            <div className="space-y-1">
              <div className="hidden lg:block px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Menu Navigasi
              </div>
              <div className="flex flex-wrap lg:flex-col gap-1 sm:gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex-1 sm:flex-initial lg:w-full flex items-center justify-between px-3 py-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-bold transition-all duration-150 ${
                        isActive
                          ? 'bg-[#1b4d3e] text-white shadow-[0_4px_14px_rgba(27,77,62,0.22)]'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#a2d2bf]' : 'text-slate-500'}`} />
                        <span className="text-left truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`whitespace-nowrap text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-1.5 shadow-2xs ${
                          isActive 
                            ? 'bg-white/20 text-[#a2d2bf]' 
                            : item.badgeColor
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Pindah ke mode Virtual HQ (kantor 2D, data API yang sama): toko yang sedang dibuka, atau mode Semua
                    Toko kalau sedang di halaman Semua Toko */}
                {virtualHqUrl && (
                  <a
                    href={virtualHqUrl}
                    title={virtualHqSemua
                      ? 'Buka Virtual HQ mode Semua Toko: staf melapor untuk seluruh jaringan dan Rexa menjalankan Agent Jaringan'
                      : 'Buka Virtual HQ: kantor 2D dengan agent dan staf Rexa, memakai data toko yang sama'}
                    className="flex-1 sm:flex-initial lg:w-full flex items-center justify-between px-3 py-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] hover:from-[#1e293b] hover:to-[#1e4976] shadow-[0_4px_14px_rgba(15,23,42,0.25)] transition-all duration-150"
                  >
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      <Gamepad2 className="w-4 h-4 shrink-0 text-sky-300" />
                      <span className="text-left truncate">Mode Virtual HQ</span>
                    </div>
                    <span className="whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-1.5 bg-sky-400/20 text-sky-200">
                      {virtualHqSemua ? 'Semua' : '2D'}
                    </span>
                  </a>
                )}

                {/* Guardrails button on mobile within the wrapped button group */}
                <button
                  onClick={openGuardrailsModal}
                  className="flex-1 sm:flex-initial lg:hidden flex items-center justify-between px-3 py-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GuardrailIcon className={`w-4 h-4 shrink-0 ${breakerTerbuka ? 'text-red-600' : 'text-[#4e8a6e]'}`} />
                    <span className="truncate">Audit &amp; Guardrails</span>
                  </div>
                  <span className={`whitespace-nowrap text-xs border px-2 py-0.5 rounded-full font-bold ml-1.5 shrink-0 ${guardrailBadge.className}`}>
                    {guardrailBadge.text}
                  </span>
                </button>
              </div>
            </div>

            {/* Governance & Failsafe (Desktop) */}
            <div className="hidden lg:block space-y-1">
              <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                Jaring Pengaman &amp; Sistem
              </div>
              <button
                onClick={openGuardrailsModal}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GuardrailIcon className={`w-4 h-4 shrink-0 ${breakerTerbuka ? 'text-red-600' : 'text-[#4e8a6e]'}`} />
                  <span className="truncate">Audit &amp; Guardrails</span>
                </div>
                <span className={`whitespace-nowrap text-xs border px-2 py-0.5 rounded-full font-bold ml-1.5 shrink-0 ${guardrailBadge.className}`}>
                  {guardrailBadge.text}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Area (Desktop Only): mt-auto menempatkan widget di bawah secara natural tanpa gap berlebih */}
        <div className="hidden lg:flex flex-col p-3.5 pt-3 space-y-3 border-t border-slate-100 shrink-0 mt-auto">
          {/* Exploration Budget Card */}
          <div className="p-3 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-[#1b4d3e]" />
                Exploration Budget
              </span>
              <span className="text-[10px] font-bold bg-[#1b4d3e]/10 text-[#1b4d3e] px-1.5 py-0.5 rounded">
                {jumlahHold} SKU uji
              </span>
            </div>
            <div className="text-[11px] text-slate-600 mb-1">
              Stok uji: <strong className="text-[#1b4d3e]">{rupiahRingkas(explorationBudget)}</strong>
            </div>
            <div className="text-[10px] text-slate-500 mt-1 leading-tight">
              10% dari setiap reorder yang ditahan tetap dibeli untuk menguji permintaan pasar.
            </div>
          </div>

          {/* Integration Status & Logout (Jarak natural dan proporsional ke tepi bawah) */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tiruan SAP S/4HANA (OData)</span>
            </div>
            <button
              onClick={onLogout}
              title="Keluar"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
