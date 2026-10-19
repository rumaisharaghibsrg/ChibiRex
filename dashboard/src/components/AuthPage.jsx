import React, { useState } from 'react';
import RexaLogo from './RexaLogo';
import { Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react';

export default function AuthPage({ mode, onBack, onSuccess }) {
  const [view, setView] = useState(mode); // 'login' | 'register'
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ name: '', business: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (view === 'register' && !form.name.trim()) e.name = 'Nama wajib diisi';
    if (view === 'register' && !form.business.trim()) e.business = 'Nama toko/bisnis wajib diisi';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email tidak valid';
    if (form.password.length < 6) e.password = 'Password minimal 6 karakter';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    // Simulate async auth
    setTimeout(() => {
      setLoading(false);
      onSuccess({ name: form.name || 'Manager', business: form.business || 'Toko Anda' });
    }, 900);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9f4] via-white to-[#eaf4ef] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back */}
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" />
          Kembali
        </button>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.08)] p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <RexaLogo className="h-14 w-auto" />
          </div>

          {/* Title */}
          <div className="text-center mb-7">
            <h1 className="text-xl font-bold text-slate-800 mb-1.5">
              {view === 'login' ? 'Selamat datang kembali 👋' : 'Buat akun baru'}
            </h1>
            <p className="text-sm text-slate-400">
              {view === 'login'
                ? 'Masuk untuk melanjutkan ke dashboard Anda'
                : 'Gratis · Tidak perlu kartu kredit'}
            </p>
          </div>

          {/* Toggle tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => setView('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                view === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Masuk
            </button>
            <button
              onClick={() => setView('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                view === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              Daftar
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'register' && (
              <>
                <Field
                  label="Nama Anda"
                  placeholder="contoh: Budi Santoso"
                  value={form.name}
                  onChange={v => set('name', v)}
                  error={errors.name}
                />
                <Field
                  label="Nama Toko / Bisnis"
                  placeholder="contoh: Kedai Kopi Nusantara"
                  value={form.business}
                  onChange={v => set('business', v)}
                  error={errors.business}
                />
              </>
            )}

            <Field
              label="Email"
              type="email"
              placeholder="email@toko.com"
              value={form.email}
              onChange={v => set('email', v)}
              error={errors.email}
            />

            {/* Password with toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className={`w-full px-4 py-3 pr-11 text-sm rounded-xl border transition-all outline-none focus:ring-2 ${
                    errors.password
                      ? 'border-red-300 focus:ring-red-100'
                      : 'border-slate-200 focus:border-[#4e8a6e] focus:ring-[#4e8a6e]/10'
                  } text-slate-800 placeholder:text-slate-300`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1b4d3e] hover:bg-[#143d31] text-white font-bold text-sm rounded-xl transition-all shadow-sm hover:shadow-md disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block" />
              ) : (
                <>
                  {view === 'login' ? 'Masuk ke Dashboard' : 'Buat Akun & Lanjutkan'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">
          Data kamu aman · Enkripsi SSL · Tidak dijual ke pihak ketiga
        </p>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', placeholder, value, onChange, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-3 text-sm rounded-xl border transition-all outline-none focus:ring-2 ${
          error
            ? 'border-red-300 focus:ring-red-100'
            : 'border-slate-200 focus:border-[#4e8a6e] focus:ring-[#4e8a6e]/10'
        } text-slate-800 placeholder:text-slate-300`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
