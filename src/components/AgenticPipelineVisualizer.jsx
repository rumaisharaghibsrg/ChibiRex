import React from 'react';
import { 
  Database, 
  Cpu, 
  CheckCircle, 
  ShieldCheck, 
  Layers
} from 'lucide-react';

export default function AgenticPipelineVisualizer() {
  const stages = [
    {
      num: "01",
      title: "Data Ingestion",
      icon: Database,
      tech: "AWS Lambda & RDS",
      items: [
        "Sinkronisasi POS, Excel & SAP BTP",
        "Data Confidence Score per SKU",
        "Pembersihan Anomali Transaksi"
      ]
    },
    {
      num: "02",
      title: "AI Reasoning Engine",
      icon: Cpu,
      tech: "AWS Bedrock & SageMaker",
      items: [
        "Kalkulasi Sales Velocity Score (Vs)",
        "Dynamic Safety Stock & Lead Time",
        "Market Basket Substitusi Relasi"
      ]
    },
    {
      num: "03",
      title: "Actionable Output",
      icon: CheckCircle,
      tech: "SAP S/4HANA REST API",
      items: [
        "Level 2 Draf PO ke SAP BTP",
        "Suppression Engine (Hold Reorder)",
        "Capital Reallocation Recommendation"
      ]
    }
  ];

  const guardrails = [
    "Filter Outlier (> 3σ)",
    "Spending Limit Harian",
    "Idempotency Key",
    "1-Click Approval (Level 2)",
    "Rollback Audit Log"
  ];

  return (
    <div className="enterprise-card p-7">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-[#4e8a6e]" />
            Arsitektur Pipeline Agentic AI
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 ml-6.5">
            Ingestion → Penalaran → Eksekusi Terkendali ke SAP
          </p>
        </div>

        <span className="text-[11px] font-medium text-slate-400">
          AWS Cloud + SAP BTP
        </span>
      </div>

      {/* 3 Pipeline Stages */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div 
              key={idx}
              className="p-5 rounded-xl bg-slate-50/60 relative flex flex-col justify-between transition-colors hover:bg-slate-50"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#1b4d3e] text-white flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5 text-[#a2d2bf]" />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#4e8a6e]">
                      TAHAP {stage.num}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">
                    {stage.tech}
                  </span>
                </div>

                <h4 className="font-semibold text-sm text-slate-800 mb-2.5">
                  {stage.title}
                </h4>

                <ul className="space-y-2 text-xs text-slate-500">
                  {stage.items.map((it, itIdx) => (
                    <li key={itIdx} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#4e8a6e] shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Guardrail Layer Bar */}
      <div className="mt-5 p-4 rounded-xl bg-slate-50/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4.5 h-4.5 text-[#1b4d3e]" />
            <div>
              <span className="font-semibold text-xs text-slate-700">
                Guardrail Layer
              </span>
              <p className="text-[10px] text-slate-400">
                Jaring pengaman berlapis di seluruh tahap pipeline
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {guardrails.map((g, gIdx) => (
              <span 
                key={gIdx} 
                className="text-[10px] font-medium text-slate-500"
              >
                {gIdx > 0 && <span className="mr-2 text-slate-300">·</span>}
                ✓ {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
