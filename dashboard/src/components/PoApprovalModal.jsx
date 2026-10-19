import React, { useState, useMemo } from 'react';
import { 
  X, 
  CheckCircle, 
  Send, 
  ShieldCheck, 
  Key, 
  FileCode, 
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PoApprovalModal({ skuItem, onClose, onConfirmApproval }) {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'payload'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedPoNumber, setGeneratedPoNumber] = useState('');

  const idempotencyKey = useMemo(() => {
    if (!skuItem) return '';
    return `IDEM-20261017-${skuItem.id.toLowerCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }, [skuItem]);

  const sapPayload = useMemo(() => {
    if (!skuItem) return {};
    return {
      header: {
        action: "CREATE_PURCHASE_ORDER",
        system: "SAP_S4HANA_ENTERPRISE",
        integrationSuite: "SAP BTP Cloud Foundry",
        idempotencyKey: idempotencyKey,
        timestamp: "2026-10-17T14:21:00.000Z",
        agenticAutonomyLevel: skuItem.autonomyLevel || "Level 2 (Human Approval)",
        guardrailsPassed: true,
        circuitBreakerStatus: "NOMINAL"
      },
      purchaseOrder: {
        companyCode: "1000 (Rexa Multi-Branch ID)",
        purchasingGroup: "001 (Automated Copilot Reorder)",
        supplierCode: skuItem.supplier.match(/\((.*?)\)/)?.[1] || "SUP-8012",
        supplierName: skuItem.supplier.split('(')[0].trim(),
        branchLocation: skuItem.branch,
        items: [
          {
            itemNo: "00010",
            materialCode: skuItem.id,
            description: skuItem.name,
            quantity: skuItem.poQuantity || 100,
            unit: skuItem.unit,
            unitNetPrice: skuItem.unitCost,
            currency: "IDR",
            netTotalAmount: (skuItem.poQuantity || 100) * skuItem.unitCost,
            calculatedSafetyStock: skuItem.safetyStock,
            salesVelocityScore: skuItem.salesVelocityScore,
            supplierLeadTimeDays: skuItem.leadTimeDays
          }
        ]
      }
    };
  }, [skuItem, idempotencyKey]);

  if (!skuItem) return null;

  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleApprove = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const poNum = "45000" + Math.floor(10000 + Math.random() * 90000);
      setGeneratedPoNumber(poNum);
      setIsSubmitting(false);
      setIsSuccess(true);
      
      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#1b4d3e', '#4e8a6e', '#8fbc8f', '#a2d2bf']
        });
      } catch (e) {}

      // Notify parent after brief view
      setTimeout(() => {
        onConfirmApproval(skuItem.id, poNum, idempotencyKey);
      }, 1800);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#1b4d3e] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 text-[#a2d2bf] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">
                  1-Click Approval Draf Purchase Order (PO)
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#a2d2bf] text-[#1b4d3e]">
                  Level 2 Otonomi
                </span>
              </div>
              <p className="text-xs text-[#a2d2bf] mt-0.5">
                Pengiriman draf transaksi terenkripsi ke SAP BTP & SAP S/4HANA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-100 bg-[#f4f7f6] px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === 'summary'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-[#1b4d3e]'
            }`}
          >
            Ringkasan Pengadaan
          </button>
          <button
            onClick={() => setActiveTab('payload')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'payload'
                ? 'border-[#1b4d3e] text-[#1b4d3e] font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-[#1b4d3e]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON Payload SAP BTP</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {isSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <CheckCircle className="w-12 h-12" />
              </div>
              <h4 className="text-xl font-extrabold text-[#1b4d3e]">
                Purchase Order Berhasil Diterbitkan!
              </h4>
              <p className="text-xs text-gray-600 max-w-md mx-auto">
                Draf telah divalidasi oleh jaring pengaman Rexa dan resmi terdaftar di sistem ERP SAP S/4HANA.
              </p>
              <div className="inline-block bg-[#f4f7f6] border border-[#a2d2bf] p-3 rounded-xl font-mono text-sm text-[#1b4d3e] font-bold mt-2">
                SAP PO #: <span className="text-emerald-700">{generatedPoNumber}</span>
              </div>
              <div className="text-[11px] text-gray-400">
                Idempotency Key: {idempotencyKey}
              </div>
            </div>
          ) : activeTab === 'summary' ? (
            <>
              {/* Product and Supplier Details */}
              <div className="bg-[#f4f7f6] p-4 rounded-xl border border-gray-200">
                <div className="text-[10px] font-bold uppercase text-gray-500 tracking-wider mb-1">
                  Detail Material & Master Supplier
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-[#1b4d3e] text-base">
                      {skuItem.name}
                    </div>
                    <div className="text-xs text-gray-600 font-mono mt-0.5">
                      SKU Code: {skuItem.id} | Kategori: {skuItem.category}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                    {skuItem.branch}
                  </span>
                </div>
                <div className="mt-3 pt-2 border-t border-gray-200/60 text-xs text-gray-600 flex justify-between">
                  <span>Supplier: <strong className="text-gray-800">{skuItem.supplier}</strong></span>
                  <span>Lead Time: <strong className="text-gray-800">{skuItem.leadTimeDays} Hari</strong></span>
                </div>
              </div>

              {/* Dynamic Order Calculation Breakdown */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-white border border-gray-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase block">Kuantitas Disarankan</span>
                  <span className="text-lg font-extrabold text-[#1b4d3e]">
                    {skuItem.poQuantity} {skuItem.unit}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Safety Stock: {skuItem.safetyStock}</span>
                </div>
                <div className="p-3 bg-white border border-gray-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase block">Harga Satuan (HPP)</span>
                  <span className="text-lg font-extrabold text-gray-800">
                    {formatRupiah(skuItem.unitCost)}
                  </span>
                  <span className="text-[10px] text-gray-400 block mt-0.5">Per {skuItem.unit}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-800 uppercase block font-semibold">Total Nilai PO</span>
                  <span className="text-lg font-extrabold text-emerald-700">
                    {formatRupiah((skuItem.poQuantity || 100) * skuItem.unitCost)}
                  </span>
                  <span className="text-[10px] text-emerald-800 block mt-0.5">Termasuk PPN</span>
                </div>
              </div>

              {/* Reasoning & Guardrails Check */}
              <div className="bg-white p-4 rounded-xl border border-[#1b4d3e]/15 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#1b4d3e]">
                  <Sparkles className="w-4 h-4 text-[#4e8a6e]" />
                  <span>Penalaran Agentic AI (Justifikasi Pengadaan)</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed bg-[#f4f7f6] p-2.5 rounded-lg">
                  {skuItem.recommendation}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Filter Outlier &lt; 3σ: Lolos</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-700">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Batas Spending Harian: Aman</span>
                  </div>
                </div>
              </div>

              {/* Idempotency Key Info */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-1 text-gray-500">
                  <Key className="w-3.5 h-3.5 text-gray-400" />
                  Idempotency Key:
                </span>
                <span className="text-gray-700 font-semibold">{idempotencyKey}</span>
              </div>
            </>
          ) : (
            /* JSON Payload Tab */
            <div>
              <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>Format Standar SAP Integration Suite OData / REST</span>
                <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded">application/json</span>
              </div>
              <pre className="p-4 bg-gray-900 text-[#a2d2bf] rounded-xl text-xs font-mono overflow-x-auto leading-relaxed max-h-72">
                {JSON.stringify(sapPayload, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {!isSuccess && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Batalkan
            </button>
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl font-bold text-xs bg-[#1b4d3e] hover:bg-[#143d31] text-white shadow-md hover:shadow-lg flex items-center gap-2 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Mengirim ke SAP BTP...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#a2d2bf]" />
                  <span>1-Click Otorisasi & Kirim ke SAP</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
