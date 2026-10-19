import React, { useState } from 'react';
import RexaLogo from './RexaLogo';
import { 
  ArrowRight, 
  ArrowLeft,
  Building2,
  Package,
  MapPin,
  CheckCircle,
  Plus,
  Trash2
} from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Info Bisnis', icon: Building2 },
  { id: 2, label: 'Data Produk', icon: Package },
  { id: 3, label: 'Lokasi Gudang', icon: MapPin },
];

const CATEGORIES = [
  'Makanan & Minuman', 'Bahan Baku', 'Produk Jadi', 'Packaging', 'Lainnya'
];

export default function OnboardingPage({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState({ 
    name: user?.business || '', 
    type: '', 
    city: '' 
  });
  const [products, setProducts] = useState([
    { id: 1, name: '', category: '', stock: '', minStock: '' }
  ]);
  const [warehouse, setWarehouse] = useState({ name: '', address: '' });

  const setBiz = (k, v) => setBusiness(b => ({ ...b, [k]: v }));
  const setWh  = (k, v) => setWarehouse(w => ({ ...w, [k]: v }));

  const addProduct = () => setProducts(p => [
    ...p, { id: Date.now(), name: '', category: '', stock: '', minStock: '' }
  ]);
  const removeProduct = (id) => setProducts(p => p.filter(x => x.id !== id));
  const setProduct = (id, key, val) =>
    setProducts(p => p.map(x => x.id === id ? { ...x, [key]: val } : x));

  const canNext1 = business.name && business.type && business.city;
  const canNext2 = products.every(p => p.name && p.category && p.stock);
  const canNext3 = warehouse.name;

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9f4] via-white to-[#eaf4ef] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <RexaLogo className="h-12 w-auto" />
        </div>

        {/* Step Tracker */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    done ? 'bg-[#1b4d3e]' : active ? 'bg-[#1b4d3e] ring-4 ring-[#1b4d3e]/20' : 'bg-slate-100'
                  }`}>
                    {done ? (
                      <CheckCircle className="w-4.5 h-4.5 text-white" />
                    ) : (
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap ${active ? 'text-[#1b4d3e]' : done ? 'text-slate-500' : 'text-slate-300'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-20 mx-1 mb-5 transition-all ${step > s.id ? 'bg-[#1b4d3e]' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-8">
          
          {/* Step 1 — Info Bisnis */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Ceritakan bisnis kamu 🏪</h2>
              <p className="text-sm text-slate-400 mb-6">Informasi ini digunakan untuk menyesuaikan dashboard dengan kebutuhan tokomu.</p>
              <div className="space-y-4">
                <Field label="Nama Toko / Bisnis" placeholder="contoh: Kedai Kopi Nusantara" value={business.name} onChange={v => setBiz('name', v)} />
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jenis Bisnis</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Café / FnB', 'Toko Ritel', 'Minimarket', 'Grosir / Distributor'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBiz('type', t)}
                        className={`py-2.5 px-4 text-xs font-semibold rounded-xl border transition-all ${
                          business.type === t
                            ? 'bg-[#eaf4ef] border-[#4e8a6e] text-[#1b4d3e]'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Kota / Lokasi" placeholder="contoh: Jakarta Pusat" value={business.city} onChange={v => setBiz('city', v)} />
              </div>
            </div>
          )}

          {/* Step 2 — Data Produk */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <Package className="w-5 h-5 text-[#4e8a6e] shrink-0" />
                Daftarkan produk awal
              </h2>
              <p className="text-sm text-slate-400 mb-6">Tambahkan beberapa produk yang ingin kamu pantau. Bisa ditambah lagi nanti.</p>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {products.map((p, idx) => (
                  <div key={p.id} className="bg-slate-50 rounded-2xl p-4 relative">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-600">Produk {idx + 1}</span>
                      {products.length > 1 && (
                        <button onClick={() => removeProduct(p.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-2.5">
                      <SmallField placeholder="Nama produk" value={p.name} onChange={v => setProduct(p.id, 'name', v)} />
                      <select
                        value={p.category}
                        onChange={e => setProduct(p.id, 'category', e.target.value)}
                        className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#4e8a6e]/15"
                      >
                        <option value="">-- Pilih kategori --</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <SmallField placeholder="Stok sekarang" value={p.stock} onChange={v => setProduct(p.id, 'stock', v)} type="number" />
                        <SmallField placeholder="Stok minimum" value={p.minStock} onChange={v => setProduct(p.id, 'minStock', v)} type="number" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={addProduct}
                className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-200 hover:border-[#4e8a6e] text-xs font-semibold text-slate-400 hover:text-[#1b4d3e] rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah produk lagi
              </button>
            </div>
          )}

          {/* Step 3 — Lokasi Gudang */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#4e8a6e] shrink-0" />
                Lokasi gudang / toko
              </h2>
              <p className="text-sm text-slate-400 mb-6">Bisa digunakan untuk beberapa cabang. Tambah cabang lain kapan saja setelah setup.</p>
              <div className="space-y-4">
                <Field label="Nama Lokasi" placeholder="contoh: Gudang Utama Jakarta" value={warehouse.name} onChange={v => setWh('name', v)} />
                <Field label="Alamat (Opsional)" placeholder="Jl. Sudirman No. 10, Jakarta Pusat" value={warehouse.address} onChange={v => setWh('address', v)} />

                <div className="bg-[#eaf4ef] rounded-2xl p-4 flex gap-3">
                  <CheckCircle className="w-4.5 h-4.5 text-[#1b4d3e] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[#1b4d3e] mb-0.5">Hampir selesai!</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Setelah ini kamu langsung masuk ke dashboard dan bisa mulai memantau stok secara real-time.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Nav Buttons */}
          <div className="flex items-center justify-between mt-8 gap-3">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-600 disabled:opacity-0 disabled:pointer-events-none transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>

            {step < STEPS.length ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 ? !canNext1 : step === 2 ? !canNext2 : false}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1b4d3e] text-white font-bold text-sm rounded-xl hover:bg-[#143d31] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Lanjut
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onComplete({ business, products, warehouse })}
                disabled={!canNext3}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1b4d3e] text-white font-bold text-sm rounded-xl hover:bg-[#143d31] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-[#1b4d3e]/20"
              >
                Masuk ke Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1b4d3e] to-[#4e8a6e] rounded-full transition-all duration-500"
            style={{ width: `${((step) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className="text-center text-xs text-slate-400 mt-2">Langkah {step} dari {STEPS.length}</p>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', placeholder, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#4e8a6e] focus:ring-2 focus:ring-[#4e8a6e]/10 outline-none transition-all text-slate-800 placeholder:text-slate-300"
      />
    </div>
  );
}

function SmallField({ type = 'text', placeholder, value, onChange }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-[#4e8a6e] focus:ring-2 focus:ring-[#4e8a6e]/10 outline-none transition-all text-slate-700 placeholder:text-slate-300"
    />
  );
}
