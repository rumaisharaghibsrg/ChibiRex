# Progress — ChibiRex

**Smart Inventory & Cash Flow Copilot** · Lomba Agentic AI Hackathon 2026

> Disusun dari pembahasan di claude.ai ([link percakapan](https://claude.ai/share/459288bb-adfd-4d82-be55-6cf142bf8bc8)) dan PDF *Rencana_Penggabungan_Dataset_Copilot.pdf* yang dibuat di percakapan tersebut.
> Terakhir diperbarui: **17 Oktober 2026**

**Cara pakai:** ubah `[ ]` menjadi `[x]` saat sebuah langkah selesai, lalu perbarui tabel ringkasan dan log progres di bagian bawah.

---

## Ringkasan Progres

| Tahap | Nama | Status | Checklist |
|---|---|---|---|
| 0 | Riset dataset & perencanaan | ✅ Selesai | 8/8 |
| 1 | Setup repo & lingkungan | ✅ Selesai | 9/9 |
| 2 | Data & mesin hitung (Bibitor) | ✅ Selesai | 13/13 |
| 3 | Logika substitusi / Market Basket (Instacart) | ✅ Selesai | 8/8 |
| 4 | Tools API + guardrail | ⬜ Belum | 0/12 |
| 5 | Agent layer (Strands + Bedrock) | ⬜ Belum | 0/6 |
| 6 | Mock API SAP | ⬜ Belum | 0/5 |
| 7 | Dashboard (Streamlit) | ⬜ Belum | 0/7 |
| 8 | Deploy ke AWS | ⬜ Belum | 0/5 |
| 9 | Paket Kuat (Backorders + Online Retail II) | ⬜ Belum | 0/9 |
| 10 | Paket Maksimal (Montgomery County + M5) | ⬜ Belum | 0/7 |
| 11 | Demo & pitch | ⬜ Belum | 0/9 |
| | **Total** | | **38/98 (±39%)** |

**Posisi sekarang:** Tahap 4 (tools API + guardrail).
**Target terdekat:** FastAPI yang membungkus mesin hitung menjadi tools tervalidasi (`get_sku_metrics`, `check_substitution`, `draft_purchase_order`, `hold_reorder`, `suggest_reallocation`) beserta guardrail di kode.

Legenda: ✅ selesai · 🟡 berjalan · ⬜ belum mulai

---

## Gambaran Proyek

Agent AI untuk usaha ritel dan grosir multi-cabang yang membantu mengelola stok dan arus kas: kapan harus reorder, kapan harus menahan pembelian, dan ke mana modal sebaiknya dialihkan.

Fitur dari proposal yang dibahas:

- **Velocity Score**: `Vs = ΣSt ÷ (n × Iavg)` per SKU per cabang
- **Predictive Stockout Alert** dengan **Confidence Score**
- **Hold Reorder** dengan cek substitusi/komplementer (Market Basket)
- **Capital Reallocation**: rekomendasi pengalihan modal dalam Rupiah
- **Deteksi Death Spiral**: membedakan "nol karena stok kosong" dan "nol karena tidak ada peminat"
- **Data Confidence Score**: mitigasi inakurasi data stok
- **Guardrail Runaway PO**: filter outlier >3σ, batas nominal PO harian, circuit breaker, idempotency key, status default *Draft*
- **1-Click Approval**: approval bertingkat (Level 2 & 3)
- **Integrasi SAP**: draf Purchase Order lewat API (mock untuk MVP)
- **Dashboard Health Score**

**Prinsip utama:** bangun data dan mesin hitungnya dulu, baru AI-nya. Semua angka dan guardrail ada di kode biasa yang diekspos sebagai REST API tervalidasi. LLM hanya memilih tools yang dipanggil dan menulis alasan keputusannya. Kalau angka dari tools salah, agent akan mengambil keputusan yang salah dengan sangat yakin.

---

## Keputusan yang Sudah Diambil

1. **Dataset digabung per peran (per modul), bukan baris demi baris.** Sumber datanya berasal dari perusahaan, negara, periode, dan mata uang yang berbeda.
2. **Paket dataset dikerjakan bertahap:** Minimal → Kuat → Maksimal. Paket Minimal dikerjakan dulu sampai demo jalan end-to-end.
3. **Jembatan kategori Bibitor ↔ Instacart:** aturan asosiasi dari aisle alkohol Instacart dipetakan ke kolom `Classification` Bibitor.
4. **Transfer model Backorders → Bibitor:** ditampilkan sebagai model pra-latih dengan skor indikatif, lalu dikalibrasi ulang saat pilot Fase 2.
5. **SAP memakai mock API** yang mengikuti format payload API Purchase Order SAP, karena sandbox api.sap.com hanya untuk membaca data.
6. **Agent:** Strands Agents SDK + Amazon Bedrock. Bedrock AgentCore bersifat opsional, untuk demo yang lebih "production".
7. **Mata uang:** USD dikonversi ke Rupiah dengan satu kurs tetap yang dicantumkan, dan diberi label "simulasi".
8. **Metode Tahap 2** (menyesuaikan kondisi data Bibitor, lihat Tahap 2): laju permintaan = penjualan setahun dari neraca stok (stok awal + pembelian − stok akhir) ÷ hari SKU aktif; metrik harian dari Januari 2016; tren naik/turun dari pembelian bulanan.
9. **Metode Tahap 3:** jembatan Bibitor ↔ Instacart di level **jenis minuman** (bukan hanya spirits/wine), karena SKU A dan SKU B bisa sama-sama spirits. Peran komplementer diukur dengan lift terhadap sesama order alkohol.
10. **SKU B demo mengikuti proposal Bagian 3:** stok sudah di bawah ROP (sistem statis akan reorder), Vs turun, dan jenisnya tidak komplementer. Modal yang diselamatkan = nilai PO yang ditahan.

### Paket dataset

| Paket | Dataset | Yang dibuka |
|---|---|---|
| **Minimal** (cukup untuk demo) | Bibitor + Instacart | Vs, reorder point, lead time per vendor, Hold Reorder + cek substitusi, Capital Reallocation, alur demo SKU A vs SKU B |
| **Kuat** | + Product Backorders + Online Retail II | Predictive Stockout Alert berbasis model, dasar Confidence Score, uji guardrail Runaway PO |
| **Maksimal** | + Montgomery County (3 tabel) + M5 | Validasi pada data riil ritel + grosir, angka akurasi forecast untuk Bagian 6 proposal |

### Peta modul → dataset

| Modul di proposal | Dataset | Hasil yang masuk ke dashboard | Paket |
|---|---|---|---|
| Velocity, reorder point, arus kas, Capital Reallocation | Bibitor | Vs per SKU per cabang, lead time per vendor, rekomendasi pengalihan modal (Rp) | Minimal |
| Logika substitusi (Market Basket) | Instacart | Aturan "kategori X sering dibeli bersama Y" | Minimal |
| Predictive Stockout Alert | Product Backorders | Model risiko stok habis | Kuat |
| Guardrail Runaway PO | Online Retail II | Skenario uji pesanan borongan untuk filter >3σ | Kuat |
| Validasi data riil ritel + grosir | Montgomery County | Vs dan pola slow/fast-moving pada data riil | Maksimal |
| Klaim akurasi forecast | M5 | Angka akurasi untuk Bagian 6 proposal | Maksimal |

---

## Tech Stack

| Kategori | Software | Untuk apa | Dipakai mulai |
|---|---|---|---|
| Dasar | Python 3.11+ (tim memakai 3.14.5), VS Code, Git + GitHub | Semua kode | Tahap 1 |
| Data | Kaggle CLI / Kaggle Notebook, DuckDB, pandas atau Polars | Unduh & olah file besar Bibitor | Tahap 2 |
| Analitik | SQL DuckDB (aturan asosiasi), scikit-learn + LightGBM, statsforecast | Aturan asosiasi, model risiko stok habis, demand forecast | Tahap 3, 9 |
| API | FastAPI + Pydantic | Tools tervalidasi dan mock API SAP | Tahap 4, 6 |
| Agent | Strands Agents SDK (alternatif: LangGraph) | Loop agent & pemanggilan tools | Tahap 5 |
| LLM | Amazon Bedrock | Penalaran agent | Tahap 5 |
| Dashboard | Streamlit | Health Score, notifikasi, 1-Click Approval | Tahap 7 |
| Cloud | Amazon S3, Lambda atau ECS, RDS PostgreSQL | Arsitektur sesuai proposal | Tahap 8 |
| SAP | SAP Business Accelerator Hub (api.sap.com), SAP BTP trial | Spesifikasi API PO & narasi integrasi | Tahap 6 |
| Pendukung | Docker, Postman atau Bruno, AWS Budgets | Deploy, uji API, alarm biaya | Kapan saja |

### Struktur repo target

```
ChibiRex/
├── data/          # raw/ (tidak di-commit, file besar) dan processed/
├── engine/        # rekonstruksi stok, Vs, lead time, ROP, market basket, model risiko
├── api/           # FastAPI: tools tervalidasi + guardrail + mock SAP
├── agent/         # Strands Agents + Bedrock
├── dashboard/     # Streamlit
├── docs/          # proposal, PDF rencana penggabungan dataset
├── tests/         # unit test (pytest)
├── progress.md
└── README.md
```

---

## Langkah Pengerjaan

### Tahap 0 — Riset dataset & perencanaan ✅

- [x] Telusuri Kaggle dan sumber lain untuk dataset yang sesuai proposal
- [x] Susun tier list dataset (S–D) beserta link, keunggulan, dan catatannya
- [x] Tetapkan paket dataset Minimal / Kuat / Maksimal
- [x] Tetapkan strategi penggabungan: per modul, jembatan kategori, dan transfer model
- [x] Buat PDF *Rencana Penggabungan Dataset* (4 halaman, 13 link bisa diklik)
- [x] Rinci file dan kolom yang diambil dari tiap dataset
- [x] Koreksi data Montgomery County: datanya **tidak dipecah per toko** (PDF sudah diperbaiki)
- [x] Tentukan langkah pertama dan daftar software

### Tahap 1 — Setup repo & lingkungan ✅

- [x] Buat repo GitHub `ChibiRex`
- [x] Buat folder `data/`, `engine/`, `api/`, `agent/`, `dashboard/`, `docs/`
- [x] Tambah `.gitignore` untuk `data/raw/`, `.env`, `kaggle.json`, `.venv/`, `__pycache__/`
- [x] Simpan proposal dan *Rencana_Penggabungan_Dataset_Copilot.pdf* ke `docs/`
- [x] Install Python 3.11+, buat virtualenv, isi `requirements.txt` (Python 3.14.5, `.venv/`, semua library lolos uji import)
- [x] Login Kaggle CLI: `kaggle auth login` (atau token di env `KAGGLE_API_TOKEN` / file `~/.kaggle/access_token`)
- [x] Cek akses data Instacart: file kompetisinya tidak tersedia lewat API (404), jadi dipakai mirror `psparks/instacart-market-basket-analysis` (isi file identik, tidak perlu menerima aturan kompetisi)
- [x] Siapkan akun AWS, lalu pasang alarm biaya di **AWS Budgets** sejak hari pertama
- [x] Tanyakan ke panitia apakah ada kredit AWS untuk peserta

### Tahap 2 — Data & mesin hitung (paket Minimal: Bibitor) ✅

Target: **satu tabel `sku_metrics`** yang dibaca oleh semua modul berikutnya.

**Cara menjalankan** (dengan `.venv` aktif): `python -m engine.pipeline` (±10 detik, data diunduh otomatis kalau belum ada) dan `pytest` untuk unit test. Hasilnya tersimpan di `data/processed/chibirex.duckdb`.

- [x] Unduh 6 file Bibitor: `kaggle datasets download -d bhanupratapbiswas/inventory-analysis-case-study` (`engine/ingest.py`)
- [x] Muat ke DuckDB, jangan diolah di Excel (Purchases ±400 MB, Sales ±128 MB). Kunci join antar-file: `InventoryId` (contoh `1_HARDERSFIELD_1004`)
- [x] Rekonstruksi stok harian per SKU per cabang: stok awal + pembelian (`ReceivingDate`) − penjualan. **Hanya Januari 2016** (79 toko × 31 hari, 6,5 juta baris), karena hanya bulan itu yang data penjualannya lengkap (`engine/stock.py`)
- [x] Hitung **Data Confidence Score**: porsi arus barang yang tidak bisa dijelaskan data (stok rekonstruksi negatif atau stok akhir > stok awal + pembelian). Hasilnya 1,0 untuk semua SKU karena data Bibitor konsisten sempurna (lihat temuan di bawah)
- [x] Hitung **Vs = ΣSt ÷ (n × Iavg)** per SKU per cabang: `vs_jan` (stok harian Januari) dan `vs_tahun` (penjualan setahun, Iavg = rata-rata stok awal dan akhir)
- [x] Hitung **lead time per vendor** = `ReceivingDate − PODate`: rata-rata 3–14 hari (median ±8), plus konsistensi vendor (1 − koefisien variasi) di tabel `vendor_metrics`
- [x] Hitung reorder point, safety stock (service level 95%), target stok, dan perkiraan tanggal stok habis
- [x] Hitung margin per unit dari `2017PurchasePricesDec` dan waktu kas keluar (rata-rata dibayar ±44 hari setelah barang diterima)
- [x] Tandai hari-hari stok kosong di Januari (`hari_stok_kosong_jan`, bahan fitur Death Spiral)
- [x] Konversi USD → Rupiah dengan kurs tetap Rp16.000 (`engine/config.py`), label "simulasi"
- [x] Simpan hasilnya sebagai tabel `sku_metrics` (276.389 SKU-toko, per 31 Des 2016) plus `stok_harian_jan`, `vendor_metrics`, `beli_bulanan`
- [x] Pilih kandidat **SKU A** dan **SKU B** di cabang yang sama (`engine/demo.py`, tabel `kandidat_demo`). Terpilih: **toko 74 (PAENTMARWY)**
  - **SKU A, Bacardi Gold Rum:** pembelian melonjak dari 142 unit (Jan–Sep) menjadi 1.553 unit (Okt–Des), stok 43 ≤ ROP 83, saran PO 107 unit (Rp13,7 juta)
  - **SKU B, Ciroc Apple Vodka** (direvisi di Tahap 3, sebelumnya Patron Reposado Tequila): laku di musim panas (Jun–Jul ±1.580 unit) lalu melambat (tren 0,37×), stok 107 ≤ ROP 117 sehingga sistem statis akan me-reorder 101 unit (Rp32 juta). Vodka tidak punya peran komplementer → Hold Reorder, dan Rp32 juta itu cukup untuk membiayai PO SKU A
- [x] Unit test rumus inti dengan data sintetis: 6 test lulus (`tests/test_engine.py`)

**Temuan data Bibitor (penting untuk pitch):**
- **File penjualan terpotong di 1.048.575 baris** (batas Excel). Penjualan hanya ada untuk Januari 2016 (lengkap) dan sebagian Februari (11 dari 79 toko). Data pembelian dan snapshot stok tetap lengkap setahun. Tidak ada unggahan Bibitor lain di Kaggle dengan penjualan setahun penuh.
- **Data konsisten sempurna:** tidak pernah ada barang terjual melebihi stok. Karena itu penjualan setahun = stok awal + pembelian − stok akhir bisa dipakai sebagai penjualan sebenarnya, dan menjadi dasar laju permintaan (÷ hari SKU aktif).
- **Pembelian mengikuti penjualan:** di Januari, median rasio penjualan/pembelian per toko 1,02. Karena itu tren pembelian bulanan dipakai sebagai indikator Vs naik/turun (`tren_beli` = rata-rata per bulan Okt–Des ÷ Jan–Sep).
- **Pola approval** cocok dengan narasi 1-Click Approval: 374 PO besar (rata-rata $485 ribu) disetujui satu orang, 5.169 PO lainnya tanpa approver.
- **Status stok per 31 Des 2016:** AMAN 138.263 · REORDER 77.674 · OVERSTOCK 51.615 · DEADSTOCK 5.788 · TIDAK_AKTIF 3.049 SKU-toko.
- **Reorder point memakai laju rata-rata setahun.** Untuk SKU yang sedang melonjak (seperti SKU A), `tren_beli` menjadi sinyal tambahan bagi agent untuk menaikkan jumlah PO.

<details>
<summary>Kolom yang diambil dari tiap file Bibitor</summary>

| File | Kolom | Untuk apa |
|---|---|---|
| BegInvFINAL12312016.csv | InventoryId, Store, Brand, onHand, Price, startDate | Titik awal rekonstruksi stok |
| EndInvFINAL12312016.csv | InventoryId, Store, Brand, onHand, endDate | Pembanding untuk Data Confidence Score |
| PurchasesFINAL12312016.csv | InventoryId, Store, Brand, VendorNumber, VendorName, PONumber, PODate, ReceivingDate, PayDate, PurchasePrice, Quantity, Classification | Stok masuk, lead time, barang dalam perjalanan, kas keluar, kategori untuk jembatan ke Instacart |
| SalesFINAL12312016.csv | InventoryId, Store, Brand, SalesDate, SalesQuantity, SalesPrice | ΣSt untuk Vs, jendela penjualan untuk model risiko |
| 2017PurchasePricesDec.csv | Brand, Price, PurchasePrice | Margin per unit untuk Capital Reallocation |
| InvoicePurchases12312016.csv | VendorNumber, PONumber, Freight, Approval | Opsional: ongkos kirim per PO dan contoh pola approval |

Diabaikan: Description dan Size (kecuali untuk label dashboard), Volume, ExciseTax, City (kecuali ingin tampilan per kota). Kapitalisasi nama kolom bisa berbeda (di tutorial ditulis `po_date`).

</details>

### Tahap 3 — Logika substitusi / Market Basket (paket Minimal: Instacart) ✅

Kode: `engine/basket.py` (aturan asosiasi & peran komplementer) dan `engine/jenis.py` (tabel mapping). Ikut berjalan di `python -m engine.pipeline` (±2 detik tambahan).

- [x] Unduh `order_products__prior.csv`, `order_products__train.csv`, `products.csv`, `aisles.csv`, dan `departments.csv` dari mirror `psparks/instacart-market-basket-analysis` (otomatis lewat pipeline). 3.346.083 order, 87.794 di antaranya (2,6%) berisi alkohol.
- [x] Ubah setiap order menjadi kumpulan item: **jenis minuman** untuk produk alkohol (tequila, rum, vodka, whiskey, gin, liqueur, brandy, wine_red, wine_white, wine_sparkling, beer) dan nama aisle untuk produk lainnya (24,3 juta baris order-item)
- [x] Hitung support, confidence, lift, dan **lift_alk** (lift dibanding sesama order alkohol). Dihitung langsung dengan SQL DuckDB, bukan mlxtend, karena lebih cepat untuk 3,3 juta order dan hanya pasangan yang melibatkan alkohol yang dibutuhkan.
- [x] Simpan aturan yang antecedent-nya jenis alkohol: tabel `aturan_asosiasi` (consequent mencakup jenis alkohol lain dan aisle non-alkohol)
- [x] Verifikasi isi kolom `Classification` Bibitor: **1 = spirits, 2 = wine** (terkonfirmasi di Tahap 2)
- [x] Buat tabel mapping manual nama produk → jenis (kata kunci jenis + merek besar) untuk Instacart dan Bibitor. Cakupan Bibitor: **spirits 93%, wine 82% dari volume penjualan**. Yang tidak terpetakan diberi status `TIDAK_DIKETAHUI`. Hasilnya di tabel `brand_jenis`.
- [x] Buat fungsi `engine.basket.cek_peran_komplementer(con, inventory_id)` yang mengembalikan jenis, status (`KOMPLEMENTER` / `TIDAK_KOMPLEMENTER` / `TIDAK_DIKETAHUI`), dan 3 mitra terkuat beserta lift-nya. Ringkasan per jenis ada di tabel `peran_komplementer`.
- [x] Unit test pemetaan jenis dan perhitungan lift dengan data sintetis: 12 test lulus (`tests/test_basket.py`), total 18 test

**Aturan keputusan:** sebuah jenis punya peran komplementer kalau ada jenis alkohol lain yang dibeli bersamanya **≥ 1,5× lebih sering** dibanding order alkohol pada umumnya, dengan **≥ 30 order bersama** (`config.BASKET_MIN_LIFT`, `BASKET_MIN_ORDERS`). Ambang ditetapkan sebelum melihat hasil untuk SKU demo.

**Hasil per jenis:**

| Jenis | Peran komplementer | Mitra terkuat (lift_alk) |
|---|---|---|
| tequila | ya | liqueur 3,24× |
| liqueur | ya | tequila 3,24× |
| gin | ya | tequila 2,73× |
| brandy | ya | liqueur 2,62× |
| whiskey | ya | gin 2,57× |
| rum | ya | gin 2,42× |
| vodka | tidak (paling tinggi gin 1,46×, di bawah ambang) | – |
| wine_red, wine_white, wine_sparkling | tidak (red ↔ white hanya 1,03×) | – |
| beer | tidak | – |

**Temuan penting:**
- **Lift terhadap semua order menyesatkan.** Hasilnya 20–245× untuk semua pasangan alkohol, karena pembeli alkohol memang membeli banyak alkohol. Karena itu dipakai lift_alk.
- **Pola yang terlihat:** spirits selain vodka dibeli berbarengan (seperti menyetok bar), sedangkan wine, vodka, dan beer dibeli sendiri-sendiri.
- **SKU B demo direvisi** sesuai proposal Bagian 3 ("Stok habis & Vs turun → cek substitusi → Hold Reorder"). Patron Reposado diganti, karena Patron berstatus OVERSTOCK (bukan stok hampir habis) dan tequila punya peran komplementer. Penggantinya Ciroc Apple Vodka (lihat Tahap 2).

### Tahap 4 — Tools API + guardrail ⬜

Guardrail ditaruh **di kode, bukan di prompt**.

- [ ] Setup FastAPI + Pydantic di `api/`
- [ ] Tool `get_sku_metrics`: membaca dari `sku_metrics`
- [ ] Tool `check_substitution`: membungkus `engine.basket.cek_peran_komplementer`
- [ ] Tool `draft_purchase_order`
- [ ] Tool `hold_reorder` (exploration budget kuartalan tetap dialokasikan)
- [ ] Tool `suggest_reallocation`: modal yang ditahan dari SKU B dialihkan ke SKU A, dalam Rupiah
- [ ] Guardrail: batas nominal PO harian
- [ ] Guardrail: filter outlier >3σ
- [ ] Guardrail: circuit breaker
- [ ] Guardrail: idempotency key
- [ ] Guardrail: status default PO = *Draft*
- [ ] Uji semua endpoint (Postman/Bruno) dan tulis unit test

### Tahap 5 — Agent layer (Strands Agents + Amazon Bedrock) ⬜

- [ ] Aktifkan akses model di Amazon Bedrock dan pilih region (AgentCore tersedia di Singapura)
- [ ] Install Strands Agents SDK, lalu bungkus tools Tahap 4 dengan dekorator `@tool` (docstring dan type hints menjadi deskripsi tool)
- [ ] Tulis system prompt: peran agent, kapan memakai tiap tool, dan kewajiban menulis alasan keputusan
- [ ] Uji skenario SKU A → agent membuat draf PO
- [ ] Uji skenario SKU B → agent memutuskan Hold Reorder lalu menyarankan Capital Reallocation
- [ ] Simpan log alasan keputusan agent untuk ditampilkan di dashboard

### Tahap 6 — Mock API SAP ⬜

- [ ] Daftar akun SAP Community, lalu ambil API key gratis di api.sap.com
- [ ] Pelajari format payload API Purchase Order SAP (`API_PURCHASEORDER_PROCESS_SRV`)
- [ ] Buat endpoint tiruan "create PO" di FastAPI dengan format payload yang sama
- [ ] Hubungkan `draft_purchase_order` ke mock SAP (status *Draft*, menunggu 1-Click Approval)
- [ ] (Opsional) Daftar SAP BTP trial **mendekati jadwal hackathon**, karena trial hanya 90 hari lalu akun dan isinya dihapus

### Tahap 7 — Dashboard (Streamlit) ⬜

- [ ] Setup Streamlit di `dashboard/`
- [ ] Tampilkan Health Score per SKU per cabang
- [ ] Tampilkan notifikasi Predictive Stockout Alert beserta Confidence Score
- [ ] Buat tombol **1-Click Approval** untuk draf PO
- [ ] Tampilkan rekomendasi Capital Reallocation dalam Rupiah
- [ ] Tampilkan alasan keputusan agent
- [ ] Beri label "simulasi" dan keterangan sumber data per modul

### Tahap 8 — Deploy ke AWS ⬜

- [ ] Upload data mentah dan hasil olahan ke Amazon S3
- [ ] Pindahkan tabel ke RDS PostgreSQL
- [ ] Deploy API dan agent ke Lambda atau ECS (pakai Docker)
- [ ] (Opsional) Pindahkan agent ke Bedrock AgentCore (Runtime, Gateway, Memory, Observability)
- [ ] Cek biaya di AWS Budgets setelah deploy

### Tahap 9 — Paket Kuat (Product Backorders + Online Retail II) ⬜

Dikerjakan jika waktu masih cukup setelah paket Minimal jalan end-to-end.

- [ ] **Backorders:** unduh file training dan test (`Kaggle_Training_Dataset_v2.csv` atau `Training_BOP.csv`). Ambil `national_inv`, `lead_time`, `in_transit_qty`, `forecast_3/6/9_month`, `sales_1/3/6/9_month`, `perf_6_month_avg`, `perf_12_month_avg`, dan target `went_on_backorder`.
- [ ] **Backorders:** bersihkan data. Nilai -99 di kolom performa supplier berarti kosong, `lead_time` ada yang kosong, dan cek baris kosong di akhir file.
- [ ] Latih classifier risiko stok habis dengan LightGBM. Kelasnya tidak seimbang, jadi pakai class weight atau undersampling, dan ukur dengan PR-AUC.
- [ ] Buat model demand forecast (statsforecast) untuk mengisi fitur `forecast_3/6/9_month`
- [ ] Hitung ulang fitur Backorders dari Bibitor (lihat tabel mapping di bawah), lalu beri skor risiko untuk tiap SKU per cabang
- [ ] Tampilkan skor sebagai model pra-latih yang bersifat indikatif dan akan dikalibrasi ulang di pilot Fase 2
- [ ] **Online Retail II:** ambil kolom Invoice, StockCode, Quantity, InvoiceDate, Price, Customer ID. Buang invoice berawalan "C", kuantitas ≤ 0, dan StockCode non-produk (POST, M).
- [ ] Per StockCode, hitung kuantitas harian, rata-rata, dan σ. Ambil hari dengan kuantitas > rata-rata + 3σ sebagai pola pesanan borongan.
- [ ] Skenario uji: suntikkan pola borongan dalam bentuk **rasio** ke satu SKU Bibitor. Hasil yang diharapkan: filter >3σ menahan draf PO dan circuit breaker aktif.

<details>
<summary>Mapping fitur Backorders → Bibitor</summary>

| Fitur Backorders | Cara menghitung dari Bibitor |
|---|---|
| `national_inv` | Stok hasil rekonstruksi pada tanggal t |
| `lead_time` | Rata-rata (tanggal terima − tanggal PO) per vendor |
| `in_transit_qty` | Jumlah barang dari PO dengan tanggal PO ≤ t < tanggal terima |
| `sales_1/3/6/9_month` | Total penjualan pada jendela 1, 3, 6, dan 9 bulan sebelum t |
| `forecast_3/6/9_month` | Output model demand forecast |
| `perf_6/12_month_avg` | Proksi: konsistensi lead time vendor (misalnya 1 − koefisien variasi) |

Data Bibitor hanya 12 bulan, jadi jendela 9 bulan baru tersedia untuk tanggal di akhir periode.

</details>

### Tahap 10 — Paket Maksimal (Montgomery County + M5) ⬜

- [ ] **Montgomery County:** export CSV ketiga tabel dari portal county: [Warehouse and Retail Sales](https://data.montgomerycountymd.gov/d/v76h-r7br), [Product Purchases by DLC](https://data.montgomerycountymd.gov/d/kpfd-c5d5), [ABS Store Inventory](https://data.montgomerycountymd.gov/d/ib5t-5ncy)
- [ ] Cek kecocokan kode item antar-tabel (`ITEM CODE`, `ITEM`, `Code`)
- [ ] Hitung Vs bulanan per item, pisahkan slow vs fast-moving, bandingkan ritel vs grosir, dan hitung berapa hari stok cukup (stok ÷ kecepatan jual)
- [ ] Mulai kumpulkan snapshot stok harian ABS selama beberapa hari, karena tabelnya hanya menyimpan kondisi saat diunduh
- [ ] **M5:** unduh `sales_train_evaluation.csv`, `calendar.csv`, dan `sell_prices.csv`. Pakai subset (misalnya kategori FOODS di 1–2 toko).
- [ ] Jadikan 28 hari terakhir sebagai data uji, lalu bandingkan model forecast dengan baseline sederhana. Hasilnya menjadi angka akurasi untuk Bagian 6 proposal.
- [ ] Uji logika Death Spiral di M5 (penjualan nol karena stok habis vs karena tidak ada peminat)

### Tahap 11 — Demo & pitch ⬜

Alur demo yang disarankan (mengikuti skop demo di Bagian 4 proposal: lonjakan SKU A vs stagnasi SKU B):

| # | Langkah | Dataset | Paket | Isi |
|---|---|---|---|---|
| 1 | Ingestion | Bibitor | Minimal | CSV → S3 → RDS/DuckDB, rekonstruksi stok harian, Data Confidence Score |
| 2 | Penalaran | Bibitor | Minimal | Hitung Vs dan lead time, pilih SKU A dan SKU B di cabang yang sama |
| 3 | SKU A: draf PO | Bibitor + Backorders | Kuat | Skor risiko + tanggal stok habis → draf PO ke SAP (mock), menunggu 1-Click Approval |
| 4 | SKU B: Hold Reorder | Bibitor + Instacart | Minimal | Tidak ada peran komplementer → Hold Reorder, exploration budget tetap dialokasikan |
| 5 | Capital Reallocation | Bibitor | Minimal | Modal dari SKU B direkomendasikan untuk SKU A, dalam Rupiah |
| 6 | Uji guardrail | Online Retail II | Kuat | Injeksi pesanan borongan → filter >3σ menahan PO, circuit breaker aktif |
| 7 | Slide validasi | Montgomery + M5 | Maksimal | Vs pada data riil ritel + grosir, akurasi forecast vs baseline |

- [ ] Siapkan data dan skenario untuk langkah 1–5 (paket Minimal)
- [ ] Siapkan skenario untuk langkah 6–7 (jika paket Kuat/Maksimal selesai)
- [ ] Siapkan skenario injeksi selisih stok (label "simulasi") supaya Data Confidence Score turun dan fitur mitigasi inakurasi data bisa didemokan, karena data Bibitor asli konsisten sempurna
- [ ] Gladi demo end-to-end
- [ ] Slide arsitektur: S3, RDS, Lambda/ECS, Bedrock, Strands Agents, AgentCore, mock SAP
- [ ] Slide "Sumber data per modul"; transparansi seperti ini menambah kredibilitas di depan juri
- [ ] Cantumkan atribusi dan catatan lisensi setiap dataset
- [ ] Slide roadmap: pilot **Fase 2** dengan data cabang riil dan kalibrasi ulang model, lalu **Fase 3** berupa audit fisik lewat foto rak (dataset gambar produk ritel Indonesia)
- [ ] Rekam video demo cadangan

---

## Catatan & Risiko

- **Lisensi Bibitor:** di Kaggle tertulis Apache 2.0, tetapi materi aslinya milik HUB of Analytics Education untuk keperluan pendidikan. Aman untuk hackathon non-komersial dengan atribusi; **jangan dipakai untuk pilot komersial**.
- **Keterbatasan Bibitor:** stok hanya berupa snapshot awal dan akhir periode, tidak ada ID keranjang, dan periodenya hanya 12 bulan (2016). **Penjualan harian hanya lengkap untuk Januari 2016** (file terpotong di batas baris Excel), dan datanya terlalu konsisten sehingga terlihat sintetis. Sampaikan ini dengan jujur di slide "Sumber data per modul". Deskripsi di halaman Kaggle-nya menyebut perusahaan manufaktur; abaikan, isinya tetap data Bibitor.
- **Instacart:** file kompetisi aslinya tidak bisa diunduh lewat API Kaggle, jadi dipakai mirror. Mirror tersebut berlabel CC0, tetapi data aslinya dirilis Instacart dengan syarat non-komersial. Cantumkan Instacart sebagai sumber.
- **Mapping jenis Bibitor ↔ Instacart** berbasis kata kunci, sehingga sebagian SKU (7% volume spirits, 18% volume wine) tidak terpetakan dan berstatus `TIDAK_DIKETAHUI`. Agent tidak boleh hold otomatis untuk SKU tersebut. Vodka berada di dekat ambang (1,46× vs 1,5×), jadi kalau ditanya juri, jelaskan bahwa ambangnya ditetapkan di awal dan bisa dikalibrasi ulang dengan data cabang riil.
- **Product Backorders:** kelasnya sangat tidak seimbang, domainnya suku cadang (bukan ritel), dan lisensinya belum terverifikasi.
- **Montgomery County:** data tidak dipecah per toko (penjualan ritel adalah gabungan semua toko, stok adalah total per item) dan lisensinya tidak dicantumkan.
- **Jangan menggabungkan baris antar-dataset** seolah-olah satu perusahaan. Periodenya berbeda (Bibitor 2016, Online Retail II 2009–2011), begitu juga negara dan mata uangnya.
- **SAP:** sandbox api.sap.com hanya untuk membaca data, jadi pembuatan PO memakai mock. SAP BTP trial berlaku 90 hari dan akun harus login minimal sekali setiap 30 hari.
- **Biaya AWS:** pasang AWS Budgets sejak awal.
- **Data Indonesia:** tidak ada dataset ritel Indonesia di Kaggle yang memuat stok dan supplier. Data riil dari cabang menjadi bagian dari Fase 2.

---

## Link Dataset

**Dipakai:**

| Dataset | Paket | Link |
|---|---|---|
| Inventory Analysis Case Study (Bibitor) | Minimal | https://www.kaggle.com/datasets/bhanupratapbiswas/inventory-analysis-case-study |
| Instacart Market Basket Analysis (mirror, dipakai) | Minimal | https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis |
| Instacart: mirror cadangan (isi sama) | Minimal | https://www.kaggle.com/datasets/yasserh/instacart-online-grocery-basket-analysis-dataset |
| Instacart: halaman kompetisi asli (untuk atribusi) | Minimal | https://www.kaggle.com/competitions/instacart-market-basket-analysis |
| Can You Predict Product Backorders? | Kuat | https://www.kaggle.com/c/untadta |
| Online Retail II UCI | Kuat | https://www.kaggle.com/datasets/mashlyn/online-retail-ii-uci |
| Montgomery County: Warehouse and Retail Sales | Maksimal | https://data.montgomerycountymd.gov/d/v76h-r7br |
| Montgomery County: Product Purchases by DLC | Maksimal | https://data.montgomerycountymd.gov/d/kpfd-c5d5 |
| Montgomery County: ABS Store Inventory | Maksimal | https://data.montgomerycountymd.gov/d/ib5t-5ncy |
| Montgomery County: salinan Kaggle (cadangan) | Maksimal | https://www.kaggle.com/datasets/divyeshardeshana/warehouse-and-retail-sales |
| M5 Forecasting – Accuracy | Maksimal | https://www.kaggle.com/competitions/m5-forecasting-accuracy |

**Referensi (cukup dibaca, tidak diunduh):**

- Tutorial Bibitor (rekonstruksi stok & lead time per vendor): https://shengpeishu.quarto.pub/rcourse-r4db/Inventory_case.html
- Kamus kolom Product Backorders (Papers with Code): https://ml.paperswithcode.com/dataset/can-you-predict-product-backorder
- Paper pembanding model Backorders (MDPI Sensors): https://www.mdpi.com/1424-8220/21/23/7926
- Konteks 26 toko & bisnis grosir Montgomery County: https://www.montgomerycountymd.gov/BONDS/Resources/Files/DLC_Continuing_Disclosure_FY2020.pdf

**Cadangan dari tier list (belum dipakai):**

- Favorita Grocery Sales (forecast multi-cabang, flag perishable): https://www.kaggle.com/c/favorita-grocery-sales-forecasting
- Dunnhumby – The Complete Journey (Market Basket toko fisik): https://www.kaggle.com/datasets/frtgnn/dunnhumby-the-complete-journey
- Historical Sales and Active Inventory (klasifikasi deadstock): https://www.kaggle.com/datasets/flenderson/sales-analysis
- Retail Store Inventory Forecasting (sintetis, mockup dashboard): https://www.kaggle.com/datasets/anirudhchauhan/retail-store-inventory-forecasting-dataset
- Grocery Inventory and Sales (template master barang & supplier): https://www.kaggle.com/datasets/salahuddinahmedshuvo/grocery-inventory-and-sales-dataset
- Supply Chain Analysis (atribut supplier): https://www.kaggle.com/datasets/harshsingh2209/supply-chain-analysis
- DataCo Smart Supply Chain (variasi lead time): https://www.kaggle.com/datasets/shashwatwork/dataco-smart-supply-chain-for-big-data-analysis

---

## Log Progres

| Tanggal | Progres |
|---|---|
| 16 Okt 2026 | Riset dataset Kaggle, tier list S–D, penetapan paket Minimal/Kuat/Maksimal, strategi penggabungan per modul, PDF rencana penggabungan dataset, rincian kolom per file, serta daftar langkah pertama dan software (di claude.ai) |
| 17 Okt 2026 | Repo `ChibiRex` sudah ada di GitHub (initial commit). `progress.md` dan `.gitignore` dibuat. Proposal dan PDF rencana dataset disimpan di `docs/`. Virtualenv `.venv` (Python 3.14.5) dan `requirements.txt` dengan versi terkunci dibuat. Login Kaggle CLI berhasil. Akses file Bibitor dan M5 terkonfirmasi. Data Instacart dialihkan ke mirror `psparks` karena file kompetisinya tidak tersedia lewat API. Akun AWS siap dan panitia sudah ditanya soal kredit. **Tahap 1 selesai.** |
| 17 Okt 2026 | **Tahap 2 selesai.** Mesin hitung `engine/` (ingest, rekonstruksi stok Januari, vendor_metrics, sku_metrics, kandidat demo) dan 6 unit test. Ditemukan bahwa penjualan Bibitor hanya lengkap untuk Januari, jadi metode disesuaikan (lihat Tahap 2). Kandidat demo: toko 74, Bacardi Gold Rum (A) vs Patron Reposado Tequila (B). |
| 17 Okt 2026 | **Tahap 3 selesai.** `engine/basket.py` dan `engine/jenis.py`: aturan asosiasi Instacart di level jenis minuman, lift_alk, tabel `peran_komplementer` dan `brand_jenis`, fungsi `cek_peran_komplementer`, dan 12 unit test baru (total 18). SKU B demo direvisi sesuai proposal Bagian 3 menjadi **Ciroc Apple Vodka** (Hold Reorder menyelamatkan Rp32 juta untuk PO Bacardi Gold Rum Rp13,7 juta). |
