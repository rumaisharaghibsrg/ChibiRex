import React from 'react';
import { RotateCcw, FlaskConical } from 'lucide-react';

export default function ScenarioBar({ activeScenario, setActiveScenario, onReset }) {
  const scenarios = [
    { 
      id: "NORMAL",        
      label: "Normal",         
      desc: "Kondisi stok stabil" 
    },
    { 
      id: "FAST_MOVING",   
      label: "Produk Laris",    
      desc: "Stok menipis cepat" 
    },
    { 
      id: "SLOW_MOVING",   
      label: "Produk Lambat",   
      desc: "Stok menumpuk" 
    },
    { 
      id: "REALLOCATION",  
      label: "Realokasi Dana",  
      desc: "Pindah modal antar produk" 
    },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-5 py-3.5 flex items-center justify-between gap-4">
      {/* Label */}
      <div className="flex items-center gap-2 shrink-0">
        <FlaskConical className="w-4 h-4 text-[#4e8a6e]" />
        <span className="text-xs font-semibold text-slate-600">Coba Skenario:</span>
      </div>

      {/* Scenario Tabs */}
      <nav className="flex items-center gap-1 flex-1 flex-wrap">
        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => setActiveScenario(sc.id)}
              title={sc.desc}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex flex-col items-start leading-tight ${
                isActive
                  ? 'bg-[#1b4d3e] text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
            >
              <span>{sc.label}</span>
              <span className={`text-[10px] font-normal ${isActive ? 'text-[#a2d2bf]' : 'text-slate-400'}`}>
                {sc.desc}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Reset */}
      <button
        onClick={onReset}
        title="Reset ke kondisi awal"
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors text-xs shrink-0 px-2 py-1.5 rounded-lg hover:bg-slate-100"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}
