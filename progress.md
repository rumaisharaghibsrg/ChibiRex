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
| 1 | Setup repo & lingkungan | 🟡 Berjalan | 4/9 |
| 2 | Data & mesin hitung (Bibitor) | ⬜ Belum | 0/12 |
| 3 | Logika substitusi / Market Basket (Instacart) | ⬜ Belum | 0/7 |
| 4 | Tools API + guardrail | ⬜ Belum | 0/12 |
| 5 | Agent layer (Strands + Bedrock) | ⬜ Belum | 0/6 |
| 6 | Mock API SAP | ⬜ Belum | 0/5 |
| 7 | Dashboard (Streamlit) | ⬜ Belum | 0/7 |
| 8 | Deploy ke AWS | ⬜ Belum | 0/5 |
| 9 | Paket Kuat (Backorders + Online Retail II) | ⬜ Belum | 0/9 |
| 10 | Paket Maksimal (Montgomery County + M5) | ⬜ Belum | 0/7 |
| 11 | Demo & pitch | ⬜ Belum | 0/8 |
| | **Total** | | **12/95 (±13%)** |

**Posisi sekarang:** Tahap 1 (setup repo).
**Target terdekat:** selesaikan Tahap 1–2 sampai tabel `sku_metrics` jadi. Ini target "minggu pertama" dari hasil pembahasan.

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
| Analitik | mlxtend, scikit-learn + LightGBM, statsforecast | Aturan asosiasi, model risiko stok habis, demand forecast | Tahap 3, 9 |
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

### Tahap 1 — Setup repo & lingkungan 🟡

- [x] Buat repo GitHub `ChibiRex`
- [ ] Buat folder `data/`, `engine/`, `api/`, `agent/`, `dashboard/`, `docs/`
- [x] Tambah `.gitignore` untuk `data/raw/`, `.env`, `kaggle.json`, `.venv/`, `__pycache__/`
- [x] Simpan proposal dan *Rencana_Penggabungan_Dataset_Copilot.pdf* ke `docs/`
- [x] Install Python 3.11+, buat virtualenv, isi `requirements.txt` (Python 3.14.5, `.venv/`, semua library lolos uji import)
- [ ] Login Kaggle CLI: `kaggle auth login` (atau token di env `KAGGLE_API_TOKEN` / file `~/.kaggle/access_token`)
- [ ] Terima aturan kompetisi Instacart di Kaggle (wajib sebelum bisa unduh)
- [ ] Siapkan akun AWS, lalu pasang alarm biaya di **AWS Budgets** sejak hari pertama
- [ ] Tanyakan ke panitia apakah ada kredit AWS untuk peserta

### Tahap 2 — Data & mesin hitung (paket Minimal: Bibitor) ⬜

Target: **satu tabel `sku_metrics`** yang dibaca oleh semua modul berikutnya.

- [ ] Unduh 6 file Bibitor: `kaggle datasets download -d bhanupratapbiswas/inventory-analysis-case-study`
- [ ] Muat ke DuckDB, jangan diolah di Excel (Purchases ±400 MB, Sales ±128 MB). Kunci join antar-file: `InventoryId` (contoh `1_HARDERSFIELD_1004`)
- [ ] Rekonstruksi stok harian per SKU per cabang: stok awal (`BegInvFINAL`) + pembelian (`ReceivingDate`) − penjualan (`SalesFINAL`)
- [ ] Hitung **Data Confidence Score**: selisih stok hasil rekonstruksi vs stok akhir tercatat (`EndInvFINAL`)
- [ ] Hitung **Vs = ΣSt ÷ (n × Iavg)** per SKU per cabang (Iavg = rata-rata stok harian hasil rekonstruksi)
- [ ] Hitung **lead time per vendor** = `ReceivingDate − PODate` (rata-rata dan variasinya)
- [ ] Hitung reorder point, safety stock, dan perkiraan tanggal stok habis
- [ ] Hitung margin per unit dari `2017PurchasePricesDec` (Price − PurchasePrice) dan waktu kas keluar dari `PayDate`
- [ ] Tandai hari-hari stok kosong (bahan fitur Death Spiral)
- [ ] Konversi USD → Rupiah dengan satu kurs tetap dan label "simulasi"
- [ ] Simpan hasilnya sebagai tabel `sku_metrics`
- [ ] Pilih kandidat **SKU A** (Vs naik tajam, misalnya brand yang penjualannya naik di Desember) dan **SKU B** (Vs turun, stok akhir tinggi) di cabang yang sama

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

### Tahap 3 — Logika substitusi / Market Basket (paket Minimal: Instacart) ⬜

- [ ] Unduh `order_products__prior.csv`, `order_products__train.csv`, `products.csv`, `aisles.csv`, dan `departments.csv` (`kaggle competitions download -c instacart-market-basket-analysis`). File `orders.csv` dan `sample_submission.csv` tidak perlu.
- [ ] Ubah setiap order menjadi kumpulan aisle (`order_id`, `product_id` → `aisle_id`, `department_id`)
- [ ] Hitung support, confidence, dan lift antar-aisle dengan mlxtend
- [ ] Simpan aturan yang melibatkan aisle alkohol (red wines, white wines, dll.), karena Bibitor hanya menjual wine dan spirits
- [ ] Verifikasi isi kolom `Classification` Bibitor (dugaan: 1 = spirits, 2 = wine)
- [ ] Buat tabel mapping manual aisle Instacart → kategori Bibitor
- [ ] Buat fungsi "apakah kategori SKU ini punya peran komplementer?" sebagai dasar keputusan Hold Reorder

### Tahap 4 — Tools API + guardrail ⬜

Guardrail ditaruh **di kode, bukan di prompt**.

- [ ] Setup FastAPI + Pydantic di `api/`
- [ ] Tool `get_sku_metrics`: membaca dari `sku_metrics`
- [ ] Tool `check_substitution`: memakai hasil Tahap 3
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
- [ ] Gladi demo end-to-end
- [ ] Slide arsitektur: S3, RDS, Lambda/ECS, Bedrock, Strands Agents, AgentCore, mock SAP
- [ ] Slide "Sumber data per modul"; transparansi seperti ini menambah kredibilitas di depan juri
- [ ] Cantumkan atribusi dan catatan lisensi setiap dataset
- [ ] Slide roadmap: pilot **Fase 2** dengan data cabang riil dan kalibrasi ulang model, lalu **Fase 3** berupa audit fisik lewat foto rak (dataset gambar produk ritel Indonesia)
- [ ] Rekam video demo cadangan

---

## Catatan & Risiko

- **Lisensi Bibitor:** di Kaggle tertulis Apache 2.0, tetapi materi aslinya milik HUB of Analytics Education untuk keperluan pendidikan. Aman untuk hackathon non-komersial dengan atribusi; **jangan dipakai untuk pilot komersial**.
- **Keterbatasan Bibitor:** stok hanya berupa snapshot awal dan akhir periode, tidak ada ID keranjang, dan periodenya hanya 12 bulan (2016). Deskripsi di halaman Kaggle-nya menyebut perusahaan manufaktur; abaikan, isinya tetap data Bibitor.
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
| Instacart Market Basket Analysis | Minimal | https://www.kaggle.com/competitions/instacart-market-basket-analysis |
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
| 17 Okt 2026 | Repo `ChibiRex` sudah ada di GitHub (initial commit). `progress.md` dan `.gitignore` dibuat. Proposal dan PDF rencana dataset disimpan di `docs/`. Virtualenv `.venv` (Python 3.14.5) dan `requirements.txt` dengan versi terkunci dibuat. |
