import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ArrowRightLeft, 
  ShieldCheck, 
  Compass,
  LogOut,
  CheckCircle2
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  openGuardrailsModal,
  urgentCount = 0,
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
      id: "reorder",
      label: "Smart Reorder & Stok",
      icon: ShoppingCart,
      badge: urgentCount > 0 ? `${urgentCount} Butuh Approval` : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: "reallocation",
      label: "Realokasi Modal",
      icon: ArrowRightLeft,
      badge: "Hemat Rp 5.5Jt",
      badgeColor: 'bg-emerald-100 text-emerald-800'
    }
  ];

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200/80 h-screen sticky top-0 flex flex-col justify-between select-none z-20 shadow-xs">
      <div className="flex flex-col">
        {/* Brand Header — Real Logo */}
        <div className="h-20 px-6 flex items-center border-b border-slate-100 bg-white">
          <img 
            src="/rexa-logo-transparent.png" 
            alt="Rexa - Inventory & Cash Flow Copilot" 
            className="h-12 w-auto max-w-[190px] object-contain transition-transform hover:scale-[1.02]"
            loading="eager"
          />
        </div>

        {/* User / Organization Profile */}
        <div className="mx-4 mt-4 mb-2 p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center gap-3">
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
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Koneksi SAP Aktif" />
        </div>

        {/* Navigation Section */}
        <div className="p-4 space-y-6">
          {/* Main Links */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Menu Navigasi
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-150 ${
                    isActive
                      ? 'bg-[#1b4d3e] text-white shadow-[0_4px_14px_rgba(27,77,62,0.22)]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#a2d2bf]' : 'text-slate-500'}`} />
                    <span className="text-left">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
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
          </div>

          {/* Governance & Failsafe */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Jaring Pengaman &amp; Sistem
            </div>
            <button
              onClick={openGuardrailsModal}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-[#4e8a6e] shrink-0" />
                <span>Audit &amp; Guardrails</span>
              </div>
              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                Aktif
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Area */}
      <div className="p-4 space-y-3 border-t border-slate-100">
        {/* Exploration Budget Card */}
        <div className="p-3.5 bg-gradient-to-br from-slate-50 to-emerald-50/40 rounded-xl border border-slate-200/70">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#1b4d3e]" />
              Exploration Budget
            </span>
            <span className="text-[10px] font-bold bg-[#1b4d3e]/10 text-[#1b4d3e] px-1.5 py-0.5 rounded">
              Q4 2026
            </span>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-600 mb-2">
            <span>Terpakai: <strong>Rp 4,2 Jt</strong></span>
            <span className="font-bold text-[#1b4d3e]">Sisa: Rp 10,8 Jt</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#1b4d3e] to-[#4e8a6e] rounded-full" 
              style={{ width: '28%' }} 
            />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 leading-tight">
            Pencegah bias algoritma: uji stok berkala untuk produk di-hold.
          </div>
        </div>

        {/* Integration Status & Logout */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>SAP BTP S/4HANA</span>
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
    </aside>
  );
}
