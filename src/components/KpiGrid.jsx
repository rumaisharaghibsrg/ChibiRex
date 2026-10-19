import React from 'react';
import { 
  Lock, 
  AlertTriangle, 
  Clock, 
  Compass, 
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

export default function KpiGrid({ kpis }) {
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const cards = [
    {
      title: "Modal Terselamatkan",
      value: formatRupiah(kpis.capitalSaved),
      subtitle: `Hemat carrying cost simpan: ${formatRupiah(kpis.carryingCostSaved)}/thn`,
      trend: "+Rp 14.5 Jt bln ini",
      icon: Lock,
      iconColor: "text-[#1b4d3e]",
      bgColor: "bg-emerald-50/70"
    },
    {
      title: "Tingkat Kejadian Stockout",
      value: `${kpis.stockoutRate}%`,
      subtitle: `Baseline industri: ${kpis.stockoutBaseline}% (Turun 81%)`,
      trend: "-9.3% risiko kehilangan pelanggan",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50/70"
    },
    {
      title: "Waktu Proses Reorder PO",
      value: `${kpis.poProcessingTimeMinutes} Menit`,
      subtitle: `Manual sebelumnya: ${kpis.poProcessingTimeBaselineHours} jam kerja tim`,
      trend: "98.5% lebih cepat ke SAP",
      icon: Clock,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50/70"
    },
    {
      title: "Exploration Budget (Q4)",
      value: formatRupiah(kpis.explorationBudget?.remaining || 10800000),
      subtitle: `Total kuartalan: ${formatRupiah(kpis.explorationBudget?.allocated || 15000000)} (Terpakai 28%)`,
      trend: "Pencegah death spiral aktif",
      icon: Compass,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50/70"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 h-full">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div 
            key={idx} 
            className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all"
          >
            <div>
              {/* Header Row */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className={`w-8 h-8 rounded-xl ${card.bgColor} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
              </div>

              {/* Big Number */}
              <div className="text-3xl lg:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {card.value}
              </div>
            </div>

            {/* Bottom Insight */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate pr-2 font-medium">{card.subtitle}</span>
              <span className="flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                {card.trend}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
