import React from 'react';
import {
  Lock,
  Clock,
  Compass,
  PackageX,
  ArrowUpRight
} from 'lucide-react';
import { angka, rupiah, rupiahRingkas } from '../lib/format';

export default function KpiGrid({ ringkasan, jumlahHold = 0 }) {
  if (!ringkasan) return null;

  const persenTertahan = ringkasan.nilai_stok_idr ? (ringkasan.modal_tertahan_idr / ringkasan.nilai_stok_idr) * 100 : 0;
  const menumpuk = (ringkasan.jumlah_status?.OVERSTOCK ?? 0) + (ringkasan.jumlah_status?.DEADSTOCK ?? 0);

  const cards = [
    {
      title: "Modal Terselamatkan",
      value: rupiah(ringkasan.modal_diselamatkan_idr),
      subtitle: `Dari ${jumlahHold} Hold Reorder aktif`,
      trend: "Siap dialihkan",
      icon: Lock,
      iconColor: "text-[#1b4d3e]",
      bgColor: "bg-emerald-50/70"
    },
    {
      title: "Modal Tertahan",
      value: rupiahRingkas(ringkasan.modal_tertahan_idr),
      subtitle: `${angka(menumpuk)} SKU overstock/deadstock`,
      trend: `${angka(persenTertahan)}% nilai stok`,
      icon: PackageX,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50/70"
    },
    {
      title: "PO Menunggu Approval",
      value: `${ringkasan.po_menunggu} PO`,
      subtitle: `Nilai ${rupiah(ringkasan.nilai_po_menunggu_idr)}`,
      trend: `${ringkasan.po_disetujui} disetujui · ${ringkasan.po_ditahan_guardrail} ditahan`,
      icon: Clock,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50/70"
    },
    {
      title: "Exploration Budget",
      value: rupiah(ringkasan.exploration_budget_idr),
      subtitle: "Stok uji 10% dari reorder yang ditahan",
      trend: "Pencegah death spiral",
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
              <div className="text-2xl lg:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight tabular-nums">
                {card.value}
              </div>
            </div>

            {/* Bottom Insight */}
            <div className="pt-4 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
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
