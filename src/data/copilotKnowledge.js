// Pengetahuan dan log penalaran untuk Rexa AI Operational Assistant
// Model Mode: Read-Only Secure Copilot (Terisolasi dari manipulasi REST API langsung)

export const quickPrompts = [
  {
    title: "Beban Kas Tertinggi",
    query: "Produk apa yang paling membebani kas bulan ini?",
    icon: "AlertCircle"
  },
  {
    title: "Modal Diselamatkan",
    query: "Berapa total modal yang berhasil diselamatkan dari penahanan reorder?",
    icon: "TrendingUp"
  },
  {
    title: "Alasan Hold Reorder",
    query: "Jelaskan mengapa SKU Sirup Hazelnut masuk status Hold Reorder",
    icon: "HelpCircle"
  },
  {
    title: "Exploration Budget",
    query: "Apa fungsi Exploration Budget dan berapa sisa kuartal ini?",
    icon: "Compass"
  },
  {
    title: "Realokasi Modal",
    query: "Bagaimana rekomendasi pengalihan modal dari deadstock ke produk laris?",
    icon: "ArrowRightLeft"
  }
];

export const getCopilotAnswer = (query, _inventoryList, _currentKpis) => {
  const q = query.toLowerCase();

  if (q.includes("membebani kas") || q.includes("beban kas") || q.includes("deadstock")) {
    return {
      text: `Berdasarkan audit inventaris saat ini, produk yang paling membebani kas adalah **SKU-002: Sirup Hazelnut Gourmet 750ml** dengan **185 botol stok tersisa** dan estimasi waktu habis mencapai **154 hari**. 

Modal kerja tertahan (*capital trapped*) pada item ini adalah sebesar **Rp 20.350.000**, dengan estimasi beban simpan gudang (*carrying cost*) tahunan sebesar ~Rp 5.087.500 (25%/tahun). 

💡 **Tindakan Agen Rexa**: Reorder otomatis telah ditahan (*Suppression Engine aktif*), menyelamatkan modal kas sebesar **Rp 5.500.000** untuk dialihkan ke produk berkecepatan tinggi (*fast-moving*) seperti Kopi Arabika Specialty.`,
      tag: "Audit Finansial",
      confidence: 98.4,
      guardrailVerified: true
    };
  }

  if (q.includes("diselamatkan") || q.includes("hemat") || q.includes("modal")) {
    return {
      text: `Total modal kerja yang berhasil diselamatkan dari penahanan reorder barang lambat (*slow-moving suppression*) mencapai **Rp 48.500.000**.

Dampak kumulatif terhadap keuangan bisnis:
1. **Beban Simpan Diselamatkan**: Rp 12.125.000 / tahun (asumsi carrying cost 25%).
2. **Likuiditas Kas Tambahan**: Rp 48.500.000 siap dialokasikan ke produk fast-moving (Kopi Arabika & Susu Oat Barista).
3. **Pencegahan Risiko Kadaluarsa**: Menurunkan potensi rugi barang rusak/usang hingga 85%.`,
      tag: "Optimasi Likuiditas",
      confidence: 96.8,
      guardrailVerified: true
    };
  }

  if (q.includes("sirup hazelnut") || q.includes("hold reorder") || q.includes("alasan hold")) {
    return {
      text: `Berikut analisis mengapa **SKU-002 (Sirup Hazelnut Gourmet)** berstatus **Hold Reorder**:

1. **Penjualan Melambat**: Kecepatan penjualan anjlok ke angka **0.28x** (sangat lambat dibanding produk rata-rata).
2. **Korelasi Substitusi**: Analisis Market Basket menunjukkan 84% pelanggan dengan mudah beralih ke *Sirup Karamel Monin* tanpa membatalkan pesanan.
3. **Stok Masih Sangat Banyak**: Stok fisik 185 botol mencukupi kebutuhan 154 hari kerja ke depan.
4. **Penyelamatan Kas**: Menahan pengadaan ini mencegah penumpukan modal mati sebesar Rp 5.500.000.`,
      tag: "Suppression Engine",
      confidence: 97.2,
      guardrailVerified: true
    };
  }

  if (q.includes("exploration") || q.includes("budget") || q.includes("death spiral") || q.includes("eksplorasi")) {
    return {
      text: `**Exploration Budget (Pencegah Death Spiral)** adalah jaring pengaman agar algoritma AI tidak bias permanen terhadap produk yang sempat sepi.

**Kondisi Kuartal Ini (Q4 2026)**:
- **Alokasi Total**: Rp 15.000.000
- **Telah Digunakan (Uji Pasar)**: Rp 4.200.000 (28%)
- **Sisa Cadangan Kas**: Rp 10.800.000
- **Akurasi Validasi Demand Riil**: 78%

💡 **Tujuan Bisnis**: Alokasi stok uji berkala diberikan secara bertahap untuk memastikan produk yang di-hold tidak dianggap mati selamanya jika tren pasar kembali pulih.`,
      tag: "Pencegah Bias Algoritma",
      confidence: 99.1,
      guardrailVerified: true
    };
  }

  if (q.includes("realokasi") || q.includes("alihkan") || q.includes("pindah modal")) {
    return {
      text: `**Rekomendasi Realokasi Modal Aktif**:

- **Sumber Dana**: Menahan pengadaan *SKU-002 (Sirup Hazelnut)* menghemat kas **Rp 5.500.000**.
- **Tujuan Alokasi**: Dialihkan ke *SKU-001 (Kopi Arabika Specialty)* yang penjualannya naik **+38%** dan stoknya sisa 2.8 hari.
- **Hasil Bisnis**:
  - Mencegah kehilangan potensi omzet (*stockout loss*) sebesar **Rp 7.200.000**.
  - Menghasilkan tambahan margin keuntungan sebesar **+Rp 2.320.000**.

Anda dapat menyetujui pengalihan ini langsung dengan 1 tombol pada modul **Realokasi Modal**.`,
      tag: "Rekomendasi Kas",
      confidence: 97.8,
      guardrailVerified: true
    };
  }

  if (q.includes("lead time") || q.includes("molor") || q.includes("kopi arabika")) {
    return {
      text: `**Simulasi Lead Time Supplier Molor (+5 Hari)**:

Jika lead time supplier *PT Java Specialty Agro* bertambah dari 3 hari menjadi 8 hari:
1. **Safety Stock Dinamis**: Otomatis dinaikkan dari 35 pcs menjadi **68 pcs** untuk mengamankan operasional.
2. **Titik Reorder (ROP)**: Bergeser dari 50 pcs ke **116 pcs**.
3. **Risiko Stockout**: Naik menjadi **99.2%** karena sisa stok saat ini hanya 42 pcs.
4. **Saran Otonom**: Kuantitas draf PO dinaikkan menjadi **180 pcs** dan diteruskan ke SAP BTP dengan prioritas ekspedisi kilat.`,
      tag: "Simulasi Pasokan",
      confidence: 93.1,
      guardrailVerified: true
    };
  }

  // Fallback
  return {
    text: `Halo, saya **Rexa Operational Copilot** (Read-Only Secure Assistant).

Status ringkasan inventaris saat ini:
- **Inventory Health Score**: 84/100 (Sangat Sehat).
- **Draf PO Menunggu Otorisasi**: 3 SKU Fast-Moving (Kopi Arabika, Susu Oat, Sirup Karamel) siap kirim ke SAP BTP.
- **Suppression Engine Aktif**: 1 SKU Slow-Moving (Sirup Hazelnut) ditahan, mengamankan kas Rp 5.500.000.
- **Exploration Budget Q4**: Tersedia sisa Rp 10.800.000 untuk uji coba stok berkala.

Silakan pilih prompt di bawah atau ketikkan pertanyaan bisnis Anda!`,
    tag: "Ringkasan Eksekutif",
    confidence: 95.0,
    guardrailVerified: true
  };
};
