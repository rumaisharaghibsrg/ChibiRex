# Progress — ChibiRex

**Rexa: Smart Inventory & Cash Flow Copilot** · Tim ChibiRex · Lomba Agentic AI Hackathon 2026

> Disusun dari pembahasan di claude.ai ([link percakapan](https://claude.ai/share/459288bb-adfd-4d82-be55-6cf142bf8bc8)) dan PDF *Rencana_Penggabungan_Dataset_Copilot.pdf* yang dibuat di percakapan tersebut.
> Terakhir diperbarui: **20 Oktober 2026**

**Cara pakai:** ubah `[ ]` menjadi `[x]` saat sebuah langkah selesai, lalu perbarui tabel ringkasan dan log progres di bagian bawah.

---

## Ringkasan Progres

| Tahap | Nama | Status | Checklist |
|---|---|---|---|
| 0 | Riset dataset & perencanaan | ✅ Selesai | 8/8 |
| 1 | Setup repo & lingkungan | ✅ Selesai | 9/9 |
| 2 | Data & mesin hitung (Bibitor) | ✅ Selesai | 13/13 |
| 3 | Logika substitusi / Market Basket (Instacart) | ✅ Selesai | 8/8 |
| 4 | Tools API + guardrail | ✅ Selesai | 13/13 |
| 5 | Agent layer (Strands + Ollama) | ✅ Selesai | 9/9 |
| 6 | Mock API SAP | ✅ Selesai (opsional dibatalkan) | 4/4 |
| 7 | Dashboard Rexa (React) | ✅ Semua bagian memakai data API; online di Amplify (24 Okt) | 8/8 |
| 8 | Deploy ke AWS (wajib untuk final) | 🟡 Dashboard (Amplify) + API (Lambda + EFS) online; LLM di laptop (opsi 4) | 7/9 |
| 9 | Paket Kuat (Backorders + Online Retail II) | ✅ Selesai | 9/9 |
| 10 | Paket Maksimal (Montgomery County + M5) | ⛔ Dibatalkan (waktu) | 0/0 |
| 11 | Demo & pitch | 🟡 Berjalan | 4/14 |
| | **Total** | | **92/104 (±88%)** |

**Posisi sekarang:** demo berjalan online di AWS: dashboard di **Amplify** (https://main.d30b19xkk8lknt.amplifyapp.com), API + guardrail + tiruan SAP di **Lambda** dengan data di **EFS**, dan agent Strands berjalan di laptop lewat worker (`python -m agent.worker`, otomatis saat login) dengan LLM **Claude Sonnet 4.6 di Amazon Bedrock** (keputusan no. 17). Panduan demo dan deploy: `docs/deploy.md`.
**Target terdekat:** (1) gladi demo online dengan timer dan rekam video cadangan; (2) deck berbahasa Inggris; (3) **final Sabtu 31 Okt 2026**.

Legenda: ✅ selesai · 🟡 berjalan · ⬜ belum mulai · ⛔ dibatalkan (dicoret, tidak dihitung)

---

## Ketentuan Lomba dari Panitia (email mentor AWS, 17 & 19 Okt 2026)

- **Alternatif selain AWS boleh dipakai selama prototipe.** Ollama (LLM lokal) dan Gemini API diizinkan, terutama selama akun AWS bermasalah. AWS dan Kiro boleh dikombinasikan dengan alternatif tersebut.
- **Solusi final harus berjalan di AWS.** Memakai layanan **AWS + SAP + Kiro** memberi **poin tambahan** dalam penilaian, jadi sebisa mungkin prioritaskan ketiganya di build final.
- **Isi final:** demo yang berjalan (MVP sudah cukup) + deck singkat berisi: masalah pelanggan, solusi agentic AI dan arsitekturnya di AWS (dan SAP bila relevan), dampak, dan apa yang dibutuhkan untuk masuk produksi. Layanan yang direkomendasikan ada di lampiran *AWS AI Services Introduction* dari panitia.
- **Verifikasi akun AWS:** akun paket gratis butuh kartu untuk verifikasi identitas sekali saja (ditahan ±USD 1, dikembalikan dalam 3–5 hari, tidak ditagih kecuali upgrade). Pakai **kartu kredit Visa/Mastercard** dengan transaksi online/internasional aktif, **bukan kartu debit** (kartu debit Indonesia sering menolak, dan ini penyebab paling umum verifikasi macet). Pakai **email kampus**, dengan nama sesuai kartu mahasiswa.
- **Mentoring:** sesi 1:1 via Zoom (±30 menit per tim); undangan dikirim ke email kampus pada Senin 19 Okt 2026. Di luar sesi, mentor boleh dihubungi saat ada kendala teknis. **Batas kirim pertanyaan mentoring: Senin 19 Okt 2026, 16.00 WIB.** Pertanyaan sudah dikirim 18 Okt dan dijawab 19 Okt (lihat di bawah).

### Jawaban pertanyaan mentoring (19 Okt 2026)

**Final**
- **Sabtu 31 Okt 2026, tatap muka. 15 menit per tim, sudah termasuk tanya jawab.** Presentasi **berbahasa Inggris**; demo dan slide diserahkan sebagai artefak pada hari itu.
- **Demo live sangat diutamakan.** Sebagian boleh berjalan lokal kalau deploy AWS terbatas, asalkan demo jelas memperlihatkan loop agentic: **plan → reason → act/tool → review, dengan human-in-the-loop**.
- Deck tanpa template dan tanpa batas halaman: ringkas, dibuka dengan diagram arsitektur yang rapi, alur cerita Problem → Solution → Impact.
- Bobot penilaian yang disebut: Technical Execution & Use of AWS/SAP **20%**, Innovation & Originality **25%**, Presentation & Storytelling **10%** (dimensi lainnya belum disebut).

**AWS**
- **Tinggalkan akun "pengalaman baru".** Buat **akun standar baru** lewat *Sign up for AWS (advanced)* dengan email kampus. Akun lama tidak mendukung Kiro dan membatasi Marketplace serta cross-region.
- Akun Free plan tidak bisa menukar kredit promosi, dan Claude tetap terblokir di Free plan karena dijual lewat Marketplace. Kredit mahasiswa lewat program **AWS Student Rewards (21 badge)**: ±US$10 di 7 badge, ±US$20 di 14 badge, dan di 21 badge 12 bulan Skill Builder Premium + voucher ujian sertifikasi US$100. Digabung dengan Free Tier di akun standar.
- Aktifkan akses **Amazon Nova dan Anthropic Claude** di konsol Bedrock. Nova untuk iterasi cepat dan murah, Claude untuk penalaran yang lebih berat (logika keputusan/approval). Kode tetap provider-agnostic.
- LLM final: **Amazon Bedrock lewat Strands**. Ollama hanya fallback lokal; **hindari Ollama di EC2**. **Bedrock AgentCore Runtime menambah poin** (memakai orkestrator agent mendapat poin tambahan, mendukung Technical Execution dan Innovation).
- Deploy MVP: **Lambda di belakang API Gateway** untuk FastAPI tools dan agent, dengan database terkelola yang ringan; ECS Fargate kalau lebih suka container yang terus berjalan. Hindari EC2 kecuali butuh GPU. Hemat biaya: serverless (scale to zero), iterasi dengan Nova, manfaatkan Free Tier, matikan resource yang menganggur, pasang alarm AWS Budgets. Data sintetis/mock boleh.

**SAP**
- Tiruan SAP **diterima untuk penjurian** asalkan realistis dan relevan. Integrasi SAP riil tidak wajib, tetapi memperkuat dimensi "Use of AWS/SAP" (20%).
- Kalau integrasi riil: targetkan OData V4 `CE_PURCHASEORDER_0001` (atau `API_PURCHASE_ORDER_SRV`, sesuai tulisan mentor). Catatan mentor: tidak semua API OData V2 deprecated.
- Akses SAP untuk finalis tersedia **atas permintaan**: sub-account SAP dengan Joule, AI Core, AI Launchpad, dan Generative AI Hub (Joule Studio Agent Builder tidak tersedia; SAP Build Code dan AI Core tersedia). S/4HANA bisa dicoba lewat cal.sap.com di atas akun AWS sendiri. SAP Learning Hub Student Edition dan trial Generative AI Hub gratis dengan email kampus.

**Kiro**
- Bukan butir nilai tersendiri, tetapi mendukung Technical Execution dan Innovation. Lakukan keduanya: **simpan spec dan steering Kiro di repo**, dan tunjukkan Kiro sebentar di demo sebagai bukti percepatan build. Kiro gratis.

**Mentoring lanjutan:** Zoom deep-dive teknis 30 menit dengan mentor AWS, diusulkan **Rabu 22 Okt 2026 siang/sore WIB** (jadwal diatur panitia). Mentoring opsional dan tidak memengaruhi nilai. Sambil menunggu, lanjut membangun secara lokal dengan Ollama.

**Strategi yang mengikuti ketentuan ini (diperbarui 19 Okt):** selama pengembangan, agent memakai Ollama di laptop. Untuk final, agent pindah ke **Amazon Bedrock lewat Strands** (cukup ganti `.env`, kode sudah provider-agnostic) dan dijalankan di **Bedrock AgentCore Runtime**, sedangkan API tools berjalan di **Lambda + API Gateway**. Demo final dibuat live dan memperlihatkan loop agentic beserta persetujuan manajer.

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
4. **Transfer model Backorders → Bibitor:** ditampilkan sebagai model pra-latih dengan skor indikatif, lalu dikalibrasi ulang saat pilot Fase 2. Model hanya memakai fitur rasio yang bebas skala (cover stok dalam bulan, tren penjualan), bukan angka mentah.
5. **SAP memakai mock API** yang mengikuti format payload API Purchase Order SAP, karena sandbox api.sap.com hanya untuk membaca data. Dikonfirmasi mentor (19 Okt): tiruan diterima untuk penjurian; integrasi SAP riil (OData V4 `CE_PURCHASEORDER_0001`) opsional untuk poin tambahan.
6. **Agent:** Strands Agents SDK. Untuk final: Amazon Bedrock (Nova untuk iterasi, Claude untuk penalaran keputusan) yang dijalankan di **Bedrock AgentCore Runtime**. Saran mentor 19 Okt: memakai orkestrator agent menambah poin.
7. **Mata uang:** USD dikonversi ke Rupiah dengan satu kurs tetap yang dicantumkan, dan diberi label "simulasi".
8. **Metode Tahap 2** (menyesuaikan kondisi data Bibitor, lihat Tahap 2): laju permintaan = penjualan setahun dari neraca stok (stok awal + pembelian − stok akhir) ÷ hari SKU aktif; metrik harian dari Januari 2016; tren naik/turun dari pembelian bulanan.
9. **Metode Tahap 3:** jembatan Bibitor ↔ Instacart di level **jenis minuman** (bukan hanya spirits/wine), karena SKU A dan SKU B bisa sama-sama spirits. Peran komplementer diukur dengan lift terhadap sesama order alkohol.
10. **SKU B demo mengikuti proposal Bagian 3:** stok sudah di bawah ROP (sistem statis akan reorder), Vs turun, dan jenisnya tidak komplementer. Modal yang diselamatkan = nilai PO yang ditahan.
11. **LLM agent: Ollama dengan Qwen3 14B di laptop** (keputusan tim 17 Okt 2026, diizinkan panitia untuk prototipe). Sebelumnya sempat dipilih Amazon Nova di Bedrock, tetapi akun AWS tertahan verifikasi. Penyedia model dipilih lewat `CHIBIREX_LLM_PROVIDER` (`ollama` / `bedrock`), sehingga build final bisa memakai Bedrock tanpa mengubah kode agent. **Update 19 Okt:** mentor meminta Bedrock lewat Strands sebagai runtime final; Ollama tetap menjadi fallback lokal dan **tidak** dijalankan di EC2.
12. **Confidence Score = peringkat risiko 0–100, bukan probabilitas mentah** (Tahap 9). Probabilitas dari model Backorders tidak terkalibrasi untuk minuman, tetapi urutannya bisa dipercaya. Level: TINGGI ≥ 90, SEDANG ≥ 70, sisanya RENDAH. Skor ini informasi untuk manajer; keputusan reorder tetap dari ROP dan guardrail.
13. **Akun dan arsitektur AWS final (saran mentor, 19 Okt 2026; lihat no. 16 untuk kondisi terkini):** akun "pengalaman baru" (proyek Do the Thing) ditinggalkan; tim membuat akun standar lewat *Sign up for AWS (advanced)* dengan email kampus. Deploy MVP memakai Lambda + API Gateway (alternatif ECS Fargate), tanpa EC2.
14. **Nama produk: Rexa; dashboard React** (keputusan tim 20 Okt 2026). Tim tetap bernama ChibiRex. Dashboard memakai desain React + Vite + Tailwind dari tim (bukan Streamlit) dan disambungkan ke API lewat **Kiro**, sekaligus menjadi bukti pemakaian Kiro. Semua angka di dashboard wajib berasal dari API; kontraknya di `docs/api-dashboard.md`.
15. **Pindah ke akun AWS standar** (keputusan 22 Okt 2026, sesuai saran mentor 19 Okt). Akun proyek tim yang sekarang (pengalaman baru, Moonshot Mode) bisa menjalankan Lambda, tetapi kuota "tokens per day" Bedrock untuk semua model Nova bernilai 0 dan tidak bisa dinaikkan, sedangkan Claude meminta formulir use case. Agent di Bedrock + AgentCore hanya mungkin di akun standar (*Sign up for AWS (advanced)*, email kampus, kartu kredit). API di akun lama tetap melayani dashboard sampai akun baru siap; penanggung jawab deploy sekarang pemegang akun baru.
16. **Opsi 4: API dan dashboard di AWS, LLM di laptop** (keputusan 22 Okt 2026). Kartu ditolak saat verifikasi akun standar, jadi demo tetap di akun proyek tim: dashboard di Amplify, API + guardrail + tiruan SAP di Lambda dengan state di EFS, dan LLM (Ollama) di laptop presenter lewat worker yang mengambil tugas dari antrian API. Mentor mengizinkan sebagian demo berjalan lokal. Kalau kemudian ada akun dengan kuota Bedrock, worker diganti agent di Bedrock AgentCore tanpa mengubah dashboard (kontrak `POST /agent-runs/mulai` tetap).
17. **LLM agent: Claude Sonnet 4.6 di Amazon Bedrock** (keputusan 25 Okt 2026). Dengan API key Bedrock, akun proyek tim ternyata bisa memanggil Claude Sonnet 4.6 dan Opus 4.6 di Sydney. Sonnet 4.6 dipilih (cukup untuk tool use, lebih hemat dari Opus): agent 2–3x lebih cepat (±20 dtk) dan laptop tidak butuh GPU. Worker tetap di laptop (opsi 4); Ollama jadi cadangan lewat `CHIBIREX_LLM_PROVIDER=ollama`.

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
| Agent | Strands Agents SDK; Bedrock AgentCore Runtime untuk final | Loop agent & pemanggilan tools, hosting agent di AWS | Tahap 5, 8 |
| LLM | Ollama + Qwen3 14B (lokal, untuk pengembangan dan fallback); Amazon Bedrock (Nova + Claude) untuk final | Penalaran agent | Tahap 5, 8 |
| Dashboard | React + Vite + Tailwind (di `dashboard/`), hosting S3 + CloudFront | Health Score, notifikasi, panel agent, 1-Click Approval | Tahap 7 |
| Cloud | Amazon S3, Lambda + API Gateway (alternatif ECS Fargate), database terkelola (RDS/Aurora PostgreSQL atau DynamoDB) | Arsitektur final (saran mentor) | Tahap 8 |
| Dev tools | Kiro | Spec dan steering untuk sebagian build (poin tambahan) | Tahap 7–8 |
| SAP | SAP Business Accelerator Hub (api.sap.com), SAP BTP trial | Spesifikasi API PO & narasi integrasi | Tahap 6 |
| Pendukung | Docker, Postman atau Bruno, AWS Budgets | Deploy, uji API, alarm biaya | Kapan saja |

### Struktur repo target

```
ChibiRex/
├── data/          # raw/ (tidak di-commit, file besar) dan processed/
├── engine/        # rekonstruksi stok, Vs, lead time, ROP, market basket, model risiko
├── api/           # FastAPI: tools tervalidasi + guardrail + mock SAP
├── agent/         # Strands Agents + Bedrock
├── dashboard/     # React + Vite (dashboard Rexa)
├── docs/          # proposal, PDF rencana penggabungan dataset
├── .kiro/         # spec dan steering Kiro (bukti pemakaian Kiro untuk juri)
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

### Tahap 4 — Tools API + guardrail ✅

Guardrail ditaruh **di kode, bukan di prompt**.

**Cara menjalankan** (dengan `.venv` aktif): `uvicorn api.main:app --reload`, lalu buka http://127.0.0.1:8000/docs (Swagger UI, bisa dipakai untuk mencoba semua endpoint). Hentikan API sebelum menjalankan `python -m engine.pipeline`, karena DuckDB tidak bisa ditulis selama API membukanya. State transaksi (PO, hold, audit) disimpan di `data/processed/state.sqlite`, terpisah dari `chibirex.duckdb` supaya tidak terhapus saat pipeline dijalankan ulang.

- [x] Setup FastAPI + Pydantic di `api/` (`main.py`, `schemas.py`, `guardrails.py`, `state.py`, `settings.py`). Request menolak field di luar skema, jadi agent tidak bisa menyelipkan misalnya `"status": "APPROVED"`.
- [x] Tool `get_sku_metrics`: `GET /sku/{inventory_id}`, plus `list_sku`: `GET /sku?store=&status_stok=` untuk mencari SKU yang perlu ditangani
- [x] Tool `check_substitution`: `GET /sku/{inventory_id}/substitution`, membungkus `engine.basket.cek_peran_komplementer`
- [x] Tool `draft_purchase_order`: `POST /purchase-orders`. Qty default = `saran_qty_po`, nilai dihitung di server (bukan oleh agent).
- [x] Tool `hold_reorder`: `POST /holds`. Hanya diizinkan kalau stok ≤ ROP, Vs turun (dengan basis Jan–Sep ≥ 90 unit), jenisnya tidak komplementer, dan Data Confidence ≥ 0,8. **Exploration budget:** 10% PO tetap dibeli sebagai stok uji, dan hold ditinjau ulang tiap kuartal.
- [x] Tool `suggest_reallocation`: `GET /stores/{store}/reallocation`. Modal dari hold aktif dialokasikan ke SKU yang perlu reorder dengan penjualan naik ≥ 1,2×, dan pesannya mengikuti format contoh di proposal.
- [x] Guardrail: batas nominal PO harian (default Rp100 juta per toko per hari, `api/settings.py`)
- [x] Guardrail: filter outlier >3σ. Qty PO > target stok + 3σ permintaan selama (lead time + review) − stok ditahan untuk review manusia.
- [x] Guardrail: circuit breaker. Terbuka otomatis kalau 3 PO ditahan guardrail dalam 60 menit; semua PO baru ditahan sampai manajer mereset lewat `POST /guardrails/circuit-breaker/reset`.
- [x] Guardrail: idempotency key. Header `Idempotency-Key` wajib; request ulang mengembalikan data yang sama (tidak membuat ganda), kunci sama dengan isi berbeda → 409.
- [x] Guardrail: status default PO = *Draft*. Hanya manajer yang bisa mengubahnya lewat approve/reject.
- [x] Uji endpoint dan unit test: 21 test API (`tests/test_api.py`, total 39 test) + uji langsung dengan uvicorn pada data asli toko 74 (lihat di bawah). Postman/Bruno tidak diperlukan karena Swagger UI di `/docs` sudah interaktif.
- [x] Endpoint 1-Click Approval (`POST /purchase-orders/{po_id}/approve` dan `/reject`), audit log (`GET /audit-log`), status guardrail (`GET /guardrails/status`). Guardrail tambahan dari proposal: Data Confidence < 0,8 → PO ditahan dengan rekomendasi audit fisik.

**Hasil uji langsung (data asli, toko 74):**
1. `check_substitution` Ciroc Apple Vodka → TIDAK_KOMPLEMENTER
2. `hold_reorder` Ciroc → 101 unit ditahan, 11 unit stok uji, **modal diselamatkan Rp28,6 juta**, review 31 Mar 2017
3. `suggest_reallocation` → *"Menahan reorder Ciroc Apple Vodka menghemat modal Rp28.555.200. Alokasikan dana ini ke Bacardi Gold Rum (penjualan naik 32,8x, ...)"*
4. `draft_purchase_order` Bacardi Gold Rum 107 unit (Rp13,7 juta) → DRAFT, lalu approve → APPROVED
5. Draf PO Bacardi 380 unit (mengikuti laju Q4) → **DITAHAN_GUARDRAIL** (OUTLIER_3SIGMA, batas wajar 217 unit). Ini skenario Runaway PO untuk demo.
6. `hold_reorder` Patron Reposado → **ditolak** (stok masih di atas ROP, tequila komplementer)

**Temuan saat uji langsung:** `suggest_reallocation` awalnya mengarahkan dana ke Ciroc Mango Vodka ("naik 209,5x") yang ternyata produk baru dengan basis 12 unit. Sekarang tren hanya dipakai kalau pembelian Jan–Sep ≥ 90 unit (`config.TREN_BASIS_MIN`), berlaku di demo, realokasi, dan guardrail hold.

### Tahap 5 — Agent layer (Strands Agents + Ollama) ✅

**Model: Qwen3 14B lewat Ollama, berjalan di laptop** (`qwen3:14b`, ±9 GB, muat di VRAM 12 GB RTX 5070 Ti Laptop). Untuk laptop dengan GPU lebih kecil, pakai `qwen3:8b` (±5 GB) lewat `.env`: `CHIBIREX_OLLAMA_MODEL=qwen3:8b`. Pengaturan hasil uji (`agent/config.py`): **konteks 8K** (model 100% di GPU; 12K–16K tumpah ke CPU dan 2–4× lebih lambat) dan ***thinking* dimatikan** (4–5× lebih cepat).

**Temuan uji model (17 Okt 2026, RTX 5070 Ti):** Qwen3 14B **tidak andal membandingkan angka sendiri**. Ditanya "stok 43, reorder point 83, perlu reorder?", ia menjawab "tidak perlu" atau "di atas reorder point", dengan maupun tanpa *thinking*.

| Mode | Data dari tool | Benar | Waktu per pertanyaan |
|---|---|---|---|
| *Thinking* mati | Angka + keputusan jadi (`perlu_reorder`, `status_stok`) | **5/5** | **3,1–3,6 dtk** |
| *Thinking* menyala | Angka + keputusan jadi | 5/5 | 14,7–16,8 dtk |
| *Thinking* mati | Angka mentah saja | 0/5 | 3,1–3,3 dtk |

**Aturan desain agent:** semua keputusan (perlu reorder, boleh hold, status stok) **diambil dari field hasil tools**, dan system prompt melarang model menghitung atau membandingkan angka sendiri. Model hanya memilih tools, merangkai alur, dan menulis alasan. Ini juga menjadi poin pitch: guardrail dan keputusan ada di kode, sehingga tetap benar walaupun memakai model kecil yang berjalan di laptop.

**Kenapa Ollama:** akun AWS tim masih tertahan verifikasi (lihat Tahap 8), dan panitia mengizinkan Ollama selama prototipe. Ollama gratis, tanpa akun, tanpa batas pemakaian, dan data stok tetap di laptop, yang menjadi cerita privasi yang cocok untuk UMKM. Kode agent tidak terikat ke penyedia model: model dibuat di `agent/llm.py` dan dipilih lewat `CHIBIREX_LLM_PROVIDER` (`ollama` atau `bedrock`), sehingga build final bisa pindah ke AWS tanpa mengubah kode agent.

**Persiapan:**

- [x] **1. Install Ollama.** Terpasang 17 Okt 2026 (Ollama 0.40.5, server berjalan di `http://localhost:11434`). Saat aplikasi meminta "Create an account", pilih **"No thanks, I'll use Ollama locally"**; akun hanya untuk model cloud Ollama. Kalau terminal belum mengenali `ollama`, buka ulang VS Code atau jalankan `$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"`. Di PowerShell: `winget install -e --id Ollama.Ollama`, lalu buka terminal baru dan cek `ollama --version`. Setelah terpasang, Ollama berjalan di latar belakang (ikon di system tray) dan melayani `http://localhost:11434`.
- [x] **2. Unduh model.** `ollama pull qwen3:14b` (9,3 GB, selesai 17 Okt 2026).
- [x] **3. Pasang dependensi Python baru.** Dengan `.venv` aktif: `pip install -r requirements.txt` (menambahkan paket `ollama`).
- [x] **4. Jalankan skrip cek.** Lulus 17 Okt 2026: tool dipanggil, kesimpulan benar ("perlu reorder"), 3,2 dtk, model 100% di GPU. `python -m agent.cek_llm`. Skrip ini memastikan server Ollama berjalan dan model sudah diunduh, lalu menguji **pemanggilan tool** lewat Strands dengan data berbentuk seperti API Tahap 4, dan **memeriksa apakah kesimpulan model sesuai field `perlu_reorder`**. Hasil yang diharapkan: *"Semua cek lulus. LLM siap untuk Tahap 5."*

**Pembangunan agent:**

**Cara menjalankan** (dengan `.venv` aktif, dua terminal): (1) `uvicorn api.main:app`, (2) `python -m agent.run --store 74`. Agent mencetak setiap tool yang dipanggil, ringkasan akhir, durasi, dan jumlah token. Untuk mengulang demo dari awal: hentikan API, hapus `data/processed/state.sqlite`, lalu jalankan lagi.

- [x] Bungkus tools API Tahap 4 sebagai tools Strands dengan dekorator `@tool` (`agent/tools.py`): `list_prioritas`, `get_sku_metrics`, `check_substitution`, `hold_reorder`, `suggest_reallocation`, `draft_purchase_order`. Agent hanya memanggil REST API lewat HTTP, sesuai proposal (*"seluruh aksi wajib melalui REST API tervalidasi"*). Hasil API diringkas ke field penting supaya muat di konteks 8K. Penolakan guardrail dikembalikan sebagai data, ada batas 15 pemanggilan tool per sesi, idempotency key per sesi, dan **pembatasan di kode**: draf PO hanya untuk SKU di daftar "naik", hold hanya untuk SKU di daftar "turun" dari `list_prioritas`. Jumlah PO selalu memakai saran sistem (model tidak bisa menentukan qty).
- [x] Tulis system prompt (`agent/prompt.py`): prosedur sesuai proposal Bagian 3, larangan menghitung atau membandingkan angka sendiri, larangan mengarang ID, PO selalu DRAFT, dan penolakan dilaporkan apa adanya
- [x] Uji skenario SKU A → agent membuat draf PO (Bacardi Gold Rum Rp13.678.880, Smirnoff 80 Proof Rp5.236.000; status DRAFT)
- [x] Uji skenario SKU B → agent memutuskan Hold Reorder lalu menyarankan Capital Reallocation (Ciroc Apple Vodka di-hold, modal diselamatkan Rp28.555.200; Capt Morgan **tidak** di-hold karena komplementer; Buchanans diserahkan ke review manusia karena jenisnya tidak diketahui)
- [x] Simpan log alasan keputusan agent untuk dashboard: endpoint `POST/GET /agent-runs` menyimpan tugas, setiap tool yang dipanggil beserta input/output, jawaban akhir, durasi, dan token. Alasan per aksi juga tercatat di audit log.

**Tambahan di API untuk agent:** label `arah_tren` (NAIK / TURUN / STABIL / TIDAK_ANDAL) dihitung di kode dengan aturan yang sama dengan guardrail; endpoint `GET /stores/{store}/prioritas` (daftar naik/turun yang disusun kode); endpoint `/agent-runs`; dan guardrail baru **satu draf PO per SKU** (draf yang belum diputuskan dikembalikan, bukan dibuat ganda antar-sesi). Total test: 50 lulus (`tests/test_agent_tools.py` menguji tools tanpa LLM).

**Hasil uji langsung (toko 74, data asli, Qwen3 14B):**

| Percobaan | Durasi | Tool | Konteks terbesar | Catatan |
|---|---|---|---|---|
| 1 | 54,8 dtk | 14 | 3.479 token | Keputusan hold benar, tapi model membuat 5 PO (3 diambil dari daftar tujuan realokasi). Lalu ditambahkan pembatasan di kode. |
| 2 | **29,7 dtk** | 10 | 2.837 token | **Semua keputusan benar.** Model sempat mencoba membuat PO untuk Capt Morgan dan Buchanans (daftar "turun") dengan alasan keliru "penjualan naik", tetapi **ditolak oleh guardrail di kode**. Momen bagus untuk pitch: model kecil bisa salah, sistem tetap aman. |

### Tahap 6 — Mock API SAP ✅

**Alur (sesuai proposal: "agen menyusun draf PO ke SAP, otorisasi final lewat 1-Click Approval"):** agent membuat draf PO → payload SAP bisa dipratinjau (`GET /purchase-orders/{po_id}/sap-payload`) → manajer approve → API membuat PO di SAP dan menyimpan **nomor PO SAP** (45xxxxxxxx). Kalau SAP gagal, persetujuan dibatalkan dan PO tetap DRAFT, sehingga tidak ada PO "disetujui" tanpa nomor SAP. PO yang ditahan guardrail tidak pernah sampai ke SAP, dan reject tidak mengirim apa pun.

**Cara menjalankan:** tiruan SAP ikut berjalan di API utama (`uvicorn api.main:app`) pada path yang sama dengan SAP asli: `http://127.0.0.1:8000/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV/A_PurchaseOrder` (dokumentasinya di `/sap/docs`). Kalau API dijalankan di port lain atau tiruan SAP dijalankan terpisah (`uvicorn sap_mock.app:app --port 8001`), set `CHIBIREX_SAP_URL`. Data tiruan SAP ada di `data/processed/sap_mock.sqlite`; hapus file ini untuk mengulang demo.

- [x] Pelajari format payload API Purchase Order SAP (`API_PURCHASEORDER_PROCESS_SRV`). Nama field diverifikasi dari kode integrasi yang memanggil API ini: header `CompanyCode`, `PurchaseOrderType` ("NB"), `Supplier`, `PurchasingOrganization`, `PurchasingGroup`, `DocumentCurrency`; item di `to_PurchaseOrderItem.results` (`PurchaseOrderItem`, `Plant`, `Material`, `OrderQuantity`); harga lewat `to_PurchaseOrderPricingElement` (`ConditionType`, `ConditionRateValue`, `ConditionCurrency`). **Catatan:** layanan OData V2 ini berstatus *deprecated* sejak Agustus 2024; penggantinya OData V4 `CE_PURCHASEORDER_0001`. Ini masuk slide "jalan menuju produksi". Mentor (19 Okt) mengingatkan bahwa tidak semua API OData V2 deprecated, dan menyarankan V4 kalau tim mengintegrasikan SAP riil.
- [x] Buat tiruan SAP "create PO" (`sap_mock/app.py`) dengan path URL, amplop respons OData V2 (`{"d": ...}`, `__metadata`), **alur token CSRF SAP Gateway** (GET `x-csrf-token: Fetch` → POST dengan token + cookie sesi), validasi field wajib dengan format galat OData, dan nomor PO berurutan mulai 4500000001
- [x] Hubungkan alur PO ke tiruan SAP (`api/sap.py`): draf menunggu 1-Click Approval, approve membuat PO di SAP dan menyimpan `sap_po_number`. Kolom baru ditambahkan otomatis ke `state.sqlite` lama (migrasi). Pemetaan: toko → plant `T074`, brand → material `BIB-4222`, vendor Bibitor → supplier, harga beli → Rupiah (simulasi); company code dan purchasing org/group memakai nilai contoh.
- [x] Test dan uji langsung: 7 test SAP (`tests/test_sap.py`, total 57 test), termasuk "SAP mati → PO tetap DRAFT". Uji langsung: agent membuat draf → approve → **PO 4500000001** di tiruan SAP (Smirnoff 80 Proof, 425 × Rp12.320 = Rp5.236.000, cocok dengan nilai PO); approve ulang ditolak 409.
- ⛔ ~~(Opsional) Daftar akun SAP Community dan ambil API key gratis di api.sap.com, untuk membandingkan format dengan sandbox SAP (sandbox hanya bisa membaca data contoh)~~ **Dibatalkan:** Tidak dikejar: tiruan SAP sudah diterima mentor untuk penjurian, dan sisa waktu dipakai untuk demo.
- ⛔ ~~(Opsional) Integrasi SAP riil untuk poin "Use of AWS/SAP": minta akses SAP untuk finalis ke panitia (sub-account dengan AI Core dan Generative AI Hub), atau coba S/4HANA lewat cal.sap.com di akun AWS sendiri (butuh instance besar yang ditagih per jam, jadi matikan setelah dipakai). Targetkan OData V4 `CE_PURCHASEORDER_0001`.~~ **Dibatalkan:** Terhambat: butuh akses SAP dari panitia dan waktu integrasi. Tiruan SAP sudah diterima mentor; jadi bahan slide jalan menuju produksi.

### Tahap 7 — Dashboard Rexa (React) ✅

**Desain dari tim (19 Okt 2026):** aplikasi React + Vite + Tailwind bermerek **Rexa** yang memuat semua fitur proposal (Health Score, Smart Reorder + prediksi stok habis, Hold Reorder, Exploration Budget, Realokasi Modal, 1-Click Approval + payload SAP, matriks guardrail + audit log, chatbot Copilot, pilihan cabang dan tingkat otonomi). Build lulus. **Kekurangannya:** semua data masih tiruan (produk kopi di `mockData.js`), nomor PO SAP dibuat acak, jawaban chatbot ditulis tetap di kode, dan belum ada cara menjalankan agent dari dashboard. Semua kekurangan ini sudah diatasi per 24 Okt (lihat checklist).

**Cara menjalankan:** API di terminal 1 (`uvicorn api.main:app`), dashboard di terminal 2 (`cd dashboard`, `npm install`, `npm run dev`, lalu buka http://localhost:5173). Kontrak API per komponen, aturan tampilan, dan daftar yang perlu diubah ada di **`docs/api-dashboard.md`**.

- [x] Desain UI/UX dashboard Rexa (React) dari tim, mencakup semua fitur di proposal Bagian 3
- [x] Endpoint backend untuk dashboard: CORS untuk Vite (`CHIBIREX_CORS_ORIGINS`), `GET /stores` (pilihan cabang), `GET /stores/{store}/ringkasan` (Inventory Health Score + KPI dari tindakan agent/manajer), `POST /agent-runs/mulai` + `GET /agent-runs/{run_id}` (agent berjalan di latar dan langkahnya bisa dipantau selagi berjalan, satu agent sekaligus). Nama agent di prompt, payload SAP, dan judul API diganti menjadi Rexa. 6 test baru (total 68 lulus). Health Score = rata-rata 3 komponen: ketersediaan stok (% SKU aktif di atas ROP), perputaran (% SKU aktif bukan OVERSTOCK/DEADSTOCK), dan stabilitas kas (% nilai stok yang tidak tertahan). Dengan data asli, skornya tersebar 52–82 antar toko; toko 74 = **69**.
- [x] Pindahkan front-end dari root repo ke `dashboard/` dan keluarkan `node_modules` dari git (commit desain sempat menyertakan 1.728 file `node_modules` yang tidak bisa dipakai karena folder `dist/` di dalamnya terabaikan `.gitignore`). Selesai 20 Okt; `node_modules/` kini ada di `.gitignore`, dan setiap anggota tim cukup menjalankan `npm install` di `dashboard/`.
- [x] **Inti demo tersambung ke API** (dikerjakan Claude supaya pasti jalan; sisanya lewat Kiro): klien `dashboard/src/lib/api.js` untuk semua endpoint, **panel agent** (`AgentRunPanel`: tombol "Jalankan Agent", fase Plan → Reason → Act → Review, langkah muncul selagi berjalan, aksi yang diblokir guardrail ditandai merah, ringkasan akhir, run terakhir dimuat ulang setelah refresh), kartu **PO Menunggu Persetujuan**, dan **1-Click Approval** dengan PO asli (`PoApprovalModal`: alasan agent, hasil guardrail, payload OData, approve/reject). Diuji di Edge headless dengan agent asli toko 74: agent 42 dtk → 2 draf PO → approve Bacardi Gold → **SAP PO #4500000001** tampil di modal dan di kartu "Sudah masuk SAP".
- [x] **Sisa dashboard tersambung ke API** (24 Okt, dikerjakan Claude di atas desain baru tim; desain tidak diubah, hanya sumber datanya): data satu toko dimuat sekali di `src/lib/useDataToko.js` dan dibagikan ke semua kartu. Pilihan toko dari `GET /stores` (80 toko); kartu Inventory Health (skor + rincian 3 komponen), Modal Terselamatkan, dan Risiko Stok Habis dari `GET /stores/{store}/ringkasan`; tabel Smart Reorder dari `GET /sku` digabung dengan PO dan Hold lewat `inventory_id` (tombol 1-Click Approval membuka PO asli, PO yang ditahan menampilkan kode guardrail, label "Hitung fisik" + Data Confidence); detail Hold (alasan agent, cek komplementer Instacart, modal dan stok uji); Exploration Budget dari `GET /holds`; Realokasi Modal dari `GET /stores/{store}/reallocation` dengan tombol "Tinjau Draf PO Tujuan"; KPI tab Realokasi; badge sidebar; banner draf PO. `mockData.js` dan `copilotKnowledge.js` dihapus.
- [x] Menu **Skenario Uji** di header memanggil API sungguhan (`src/lib/skenario.js`, urutan sama dengan skrip terminal): **Uji Runaway PO** (3 PO lonjakan 18,5× → ditahan 3σ/batas harian → circuit breaker terbuka → PO normal ikut ditahan), **Simulasi selisih stok** (Data Confidence 1 → 0,74), **Audit stok selesai**. Modal Audit & Guardrails menampilkan status asli, tombol **reset circuit breaker oleh manajer**, daftar hitung fisik yang menunggu audit, dan audit log asli.
- [x] Klaim tanpa sumber dibersihkan: KPI stockout 2,1%/akurasi/waktu proses, "SAP BTP", "AWS Bedrock", "% Akurasi" chatbot, Auto PO Level 3. Level 1 "belum aktif", Level 2 "aktif", Level 3 "segera hadir". Header menampilkan "Data simulasi · 31 Des 2016" dan status API; sumber per modul disebut di kartu (LightGBM indikatif, Market Basket Instacart, Online Retail II di skenario).
- [x] Chatbot Copilot menjawab dari data API toko yang sedang dibuka (`src/lib/copilot.js`: modal, draf PO, alasan Hold, realokasi, risiko stok habis, Health Score, guardrail) dan berlabel "belum memakai LLM". Diuji di Edge headless terhadap API lokal: semua tab, ganti toko, kedua skenario, reset breaker, audit stok, modal PO dan Hold, Copilot, dan lebar HP 390 px tanpa scroll horizontal. Build dan oxlint lulus; 81 test backend lulus.

### Tahap 8 — Deploy ke AWS (wajib untuk final) 🟡

**Arah dari mentor (19 Okt 2026):** akun standar baru; LLM lewat **Amazon Bedrock + Strands** (Nova untuk iterasi, Claude untuk penalaran keputusan); agent di **Bedrock AgentCore Runtime** (poin tambahan); API tools di **Lambda + API Gateway** (atau ECS Fargate); tanpa EC2. Final boleh sebagian berjalan lokal kalau deploy terbatas, tetapi targetkan semuanya di AWS.

**Persiapan akun AWS (akun standar baru):**

- ⛔ ~~**1. Daftar akun standar** lewat *Sign up for AWS (advanced)*: https://portal.aws.amazon.com/billing/signup. Pakai **email kampus**, **kartu kredit Visa/Mastercard** (bukan kartu debit) dengan transaksi online/internasional aktif, dan nama sesuai kartu mahasiswa.~~ **Dibatalkan:** Terhambat: kartu ditolak saat verifikasi pembayaran (22 Okt). Diganti opsi 4 di akun proyek tim (keputusan no. 16).
  - **Pilih paket dengan sadar.** Free plan cukup untuk Amazon Nova, tetapi Claude (Marketplace) dan kredit promosi (termasuk kredit Student Rewards) hanya bisa dipakai di **Paid plan**, yang menagih kartu untuk pemakaian di atas Free Tier/kredit. Saran: mulai dengan Free plan + Nova, lalu upgrade ke Paid plan hanya kalau Claude benar-benar dibutuhkan, setelah alarm Budgets terpasang.
- ⛔ ~~**2. Amankan akun:** aktifkan MFA untuk root user, buat user untuk kerja harian (IAM Identity Center atau user IAM), dan jangan memakai root sehari-hari.~~ **Dibatalkan:** Ikut batal karena akun standar tidak jadi dipakai.
- [ ] **3. Pasang alarm AWS Budgets** (misalnya US$5 dan US$20) sebelum membuat resource apa pun.
- [x] **4. Install AWS CLI v2.** Terpasang: aws-cli 2.38.1 (`winget install -e --id Amazon.AWSCLI`). Kalau terminal belum mengenali `aws`, buka ulang VS Code atau jalankan `$env:Path += ";C:\Program Files\Amazon\AWSCLIV2"`.
- [x] **5. Login CLI.** Tercapai di akun proyek tim (Moonshot Mode): `aws login --profile rexa` (22 Okt), dipakai skrip deploy.
- ⛔ ~~**6. Aktifkan akses model di Bedrock:** Amazon Nova dan Anthropic Claude (Claude butuh Paid plan). Pilih region yang menyediakan keduanya dan juga AgentCore.~~ **Dibatalkan:** Terhambat: di akun proyek tim kuota tokens per day semua model Nova = 0 dan tidak bisa dinaikkan; Claude butuh formulir use case dan Paid plan.
- ⛔ ~~**7. Tes Bedrock:** set `CHIBIREX_LLM_PROVIDER=bedrock` di `.env`, lalu jalankan `python -m agent.cek_llm` (atau `python -m agent.cek_bedrock --claude` untuk Claude). Harga: https://aws.amazon.com/bedrock/pricing/.~~ **Dibatalkan:** Terhambat: sudah dites 22 Okt, semua model Nova menjawab ThrottlingException (kuota 0).
- [ ] **8. Daftar AWS Student Rewards (21 badge)** dan verifikasi profil mahasiswa untuk kredit.

<details>
<summary>Akun lama "Do the Thing" (pengalaman baru AWS, ditinggalkan 19 Okt 2026)</summary>

- Tanpa akun root, login lewat AWS Builder ID (Google), region terkunci di Asia Pacific (Sydney) `ap-southeast-2`, kredensial CLI lewat `aws login` (berhasil 17 Okt 2026).
- Bedrock tertahan verifikasi akun (*"Your account is currently being verified"*), dengan kasus dukungan Case ID 179219134100369.
- Free plan memblokir Claude dan kredit promosi, dan akun jenis ini tidak mendukung Kiro. Mentor menyarankan tidak menghabiskan waktu lagi untuk akun ini.

</details>

**Deploy:**

- [x] State (`state.sqlite`: PO, hold, idempotency, circuit breaker, jejak agent, audit log) dan tiruan SAP dipindah ke **Amazon EFS** `rexa-state` (access point `/rexa`, terpasang di `/mnt/rexa`; Lambda masuk VPC default dengan security group `rexa-lambda`, EFS hanya menerima NFS dari grup itu). Dipakai bersama semua instance Lambda dan tidak hilang saat cold start, tanpa mengubah logika guardrail (transaksi SQLite tetap). Selesai 22 Okt; diuji dengan 8 request paralel. Database terkelola (RDS/DynamoDB) tetap jadi jalan menuju produksi.
- [x] Data analitik (`chibirex.duckdb`, hanya dibaca) ikut di dalam image container API (bukan S3; tabel risiko sudah ada di dalamnya, file model tidak dibutuhkan API).
- [x] Deploy FastAPI (tools + tiruan SAP) ke Lambda `chibirex-api-function` (container image di ECR `chibirex-api`, Function URL di `ap-southeast-2`, memori 1024 MB). Deploy awal oleh tim 21–22 Okt; **22 Okt dirapikan dan bisa diulang dari repo:**
  - `Dockerfile` + `.dockerignore` + `requirements-lambda.txt` (Python 3.12, hanya paket yang dipakai API) dan handler `api/lambda_handler.py` (Mangum, DuckDB dibuka sekali per cold start, bukan setiap request).
  - Di Lambda otomatis: state dan tiruan SAP di `/tmp`, tiruan SAP dipanggil di proses yang sama (sebelumnya approve memanggil `127.0.0.1:8000` yang tidak ada di Lambda), CORS untuk `chibirex-dashboard.vercel.app` + preview-nya, tombol agent menjawab 503 `AGENT_BELUM_TERSEDIA`.
  - Jalur "agent cadangan" berbasis aturan yang sempat ada di image lama (membuat PO/hold tanpa LLM tetapi tercatat sebagai agent berhasil dengan model Ollama) **dihapus**, karena menyesatkan juri.
  - **Cara deploy ulang:** Docker Desktop menyala → `aws login --profile rexa` → `powershell -ExecutionPolicy Bypass -File deploy\deploy_lambda.ps1` (build, uji di kontainer hanya-baca, push ke ECR, perbarui Lambda; `-UjiSaja` untuk uji tanpa deploy). Jangan deploy dari salinan kode lain, supaya versi repo tidak tertimpa.
  - Hasil cek online: `/stores/74/ringkasan`, endpoint hitung fisik, CORS Vercel, dan **draf PO → 1-Click Approval → SAP PO #4500000001** berjalan. Waktu proses di server 5–100 ms per request (cold start ±5 dtk); sisa ±2 dtk dari laptop tim adalah jaringan/TLS ke Sydney.
- ⛔ ~~Deploy agent Strands ke Bedrock AgentCore Runtime. **Tertunda:** kuota Bedrock akun proyek = 0 dan akun standar gagal karena kartu ditolak. Sementara (opsi 4, keputusan no. 16) LLM berjalan di laptop lewat worker `python -m agent.worker` dalam **mode antrian**: tombol dashboard → tugas MENUNGGU di API → worker mengambil, menjalankan agent dengan Ollama, dan melaporkan setiap langkah ke API (token `X-Worker-Token`).~~ **Dibatalkan:** Terhambat oleh kuota Bedrock. Diganti worker di laptop (mode antrian, keputusan no. 16).
- [x] Dashboard React di **AWS Amplify** `rexa-dashboard`: https://main.d30b19xkk8lknt.amplifyapp.com (deploy manual tanpa GitHub lewat `deploy\deploy_dashboard.ps1`; alamat API diambil dari Function URL). Domain Amplify sudah ada di `CHIBIREX_CORS_ORIGINS`. Vercel tetap jalan untuk data, tetapi link resmi sekarang Amplify.
- [x] Uji end-to-end online (22 Okt, Edge headless di dashboard Amplify): worker aktif → **Jalankan Agent** → MENUNGGU (3 dtk) → langkah tampil langsung → selesai 57 dtk (hold Ciroc + 2 draf PO) → 1-Click Approval → **SAP PO #4500000001**. Reset data demo: `python -m agent.reset_demo` (endpoint `POST /demo/reset`, butuh token). Panduan lengkap demo dan deploy: **`docs/deploy.md`**. Alarm AWS Budgets belum dipasang.

### Tahap 9 — Paket Kuat (Product Backorders + Online Retail II) ✅

**Cara menjalankan:** semua ikut di `python -m engine.pipeline` (data diunduh otomatis; model dilatih sekali lalu disimpan di `models/`, latih ulang dengan `python -m engine.risiko --latih`). Skenario uji: dengan API berjalan, `python -m agent.skenario_runaway --store 74` (circuit breaker direset otomatis di akhir; `--biarkan-terbuka` untuk menahannya).

- [x] **Backorders:** dataset lengkap dari mirror `chandanareddy12/back-order-prediction` (versi kompetisi `untadta` hanya ±1 MB): **1.687.860 baris train, 242.075 baris test**, porsi backorder 0,67% / 1,11%. Lisensi di Kaggle: *unknown*, jadi cantumkan sebagai sumber edukasi.
- [x] **Backorders:** bersihkan data. Kedua file diakhiri baris penutup `(1687860 rows)` sisa ekspor database, jadi baris itu dibuang saat dibaca. `lead_time` yang kosong dan nilai -99 dibiarkan sebagai data kosong (LightGBM menanganinya).
- [x] Latih classifier risiko stok habis dengan LightGBM (`engine/risiko.py`), tanpa pembobotan kelas supaya probabilitas tetap terkalibrasi. Di data test: **PR-AUC 0,227** (aturan sederhana "stok paling sedikit dulu" 0,078) dan **ROC-AUC 0,927** (aturan 0,839). Model ±2,9× lebih tepat menemukan SKU yang akan kehabisan stok.
- [x] Hitung fitur yang sama dari Bibitor (lihat tabel di bawah), lalu beri skor risiko untuk setiap SKU per cabang (tabel `risiko_stockout`). Rata-rata risiko berurutan masuk akal: REORDER 0,095 > AMAN 0,032 > DEADSTOCK 0,015 > OVERSTOCK 0,011.
- [x] Tampilkan skor sebagai model pra-latih yang indikatif. Probabilitas mentah **tidak terkalibrasi** untuk Bibitor (di 10% teratas data test, model memperkirakan 5,6% padahal aktualnya 8,8%; ditambah perbedaan industri), tetapi urutannya bisa dipercaya. Karena itu **Confidence Score = skor peringkat 0–100** di antara SKU yang masih laku: TINGGI ≥ 90, SEDANG ≥ 70, sisanya RENDAH. Skor ini tampil di API (`skor_risiko`, `level_risiko`) dan di ringkasan agent; kalibrasi ulang di pilot Fase 2.
- [x] **Online Retail II** (`engine/borongan.py`, lisensi CC0): buang invoice pembatalan (berawalan "C"), kuantitas atau harga ≤ 0, dan kode non-produk (POST, M, BANK CHARGES, dll.; kode produk diawali 5 digit).
- [x] Per produk, hitung penjualan harian (termasuk hari tanpa penjualan), rata-rata, dan σ; hari > rata-rata + 3σ dicatat sebagai pesanan borongan. Hasil: **4.549 dari 5.243 produk (87%) pernah mengalami lonjakan >3σ** (30.060 hari borongan), dengan **lonjakan tipikal 18,5× rata-rata harian** (p90: 56×). Di bisnis grosir, membaca satu hari borongan sebagai tren akan membuat PO membengkak belasan kali.
- [x] Skenario uji Runaway PO (`agent/skenario_runaway.py`): sistem naif mengalikan PO dengan lonjakan 18,5×. Hasil dengan data asli toko 74: 3 PO (Bacardi Gold 1.980 unit vs normal 107, Smirnoff 80 Proof 7.863 vs 425, Bacardi Superior 5.680 vs 307) **ditahan** OUTLIER_3SIGMA (dua juga BATAS_HARIAN) → **circuit breaker terbuka** → PO normal Smirnoff Strawberry (146 unit) ikut ditahan CIRCUIT_BREAKER → manajer mereset.
- [x] Test: 5 test baru (`tests/test_tahap9.py`, total 62 lulus), termasuk regresi bug fitur rasio (0/0 sempat menjadi nilai batas 24 karena `least()` di DuckDB mengabaikan NULL).

**Uji agent dengan Confidence Score (data asli, toko 74):** keputusan tetap benar, dan ringkasan agent kini menyebut level risiko: Bacardi Gold Rum **TINGGI (skor 100)**, Smirnoff 80 Proof **TINGGI (skor 99)**. Percobaan model membuat PO untuk SKU di luar daftar 'naik' tetap diblokir. 37,7 dtk, 11 panggilan tool, konteks terbesar 3.044 token.

<details>
<summary>Fitur model dan padanannya di Bibitor</summary>

Model hanya memakai **fitur rasio yang tidak bergantung skala**, karena Backorders (suku cadang) dan Bibitor (minuman) berbeda satuan dan skala:

| Fitur | Rumus | Padanan di Bibitor (per 31 Des 2016) |
|---|---|---|
| `cover_forecast_bulan` | stok ÷ (ramalan 3 bulan / 3) | stok akhir ÷ (laju harian × 91 / 3) |
| `cover_jual_bulan` | stok ÷ (penjualan 3 bulan / 3) | penjualan diproksikan dengan pembelian Okt–Des |
| `stok_habis`, `ada_forecast` | stok ≤ 0; ramalan > 0 | sama |
| `transit_per_forecast` | barang dalam perjalanan ÷ ramalan 3 bulan | 0 (semua PO sudah diterima per 31 Des) |
| `tren_jual_1v3`, `tren_jual_3v9` | penjualan 1 vs 3 bulan, 3 vs 9 bulan | pembelian Des vs Okt–Des, Okt–Des vs Apr–Des |
| `forecast_per_jual` | ramalan ÷ penjualan 3 bulan | sama dengan proksi di atas |
| `lead_time_minggu` | lead time (minggu) | lead time vendor (hari) ÷ 7 |

Rasio dibatasi 24 dan penyebut nol menjadi data kosong. Fitur performa supplier (`perf_6/12_month_avg`) tidak dipakai karena Bibitor tidak punya data ketepatan waktu kirim yang setara. Ramalan memakai laju harian × horizon; model demand forecast (statsforecast) dipindah ke Tahap 10 bersama benchmark M5.

</details>

### Tahap 10 — Paket Maksimal (Montgomery County + M5) ⛔

**Dibatalkan (22 Okt 2026):** waktu tidak cukup sebelum final 31 Okt, dan validasi ini bukan syarat demo. Validasi pada data riil ritel dan angka akurasi forecast dipindah ke roadmap pilot Fase 2.

- ⛔ ~~**Montgomery County:** export CSV ketiga tabel dari portal county: [Warehouse and Retail Sales](https://data.montgomerycountymd.gov/d/v76h-r7br), [Product Purchases by DLC](https://data.montgomerycountymd.gov/d/kpfd-c5d5), [ABS Store Inventory](https://data.montgomerycountymd.gov/d/ib5t-5ncy)~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~Cek kecocokan kode item antar-tabel (`ITEM CODE`, `ITEM`, `Code`)~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~Hitung Vs bulanan per item, pisahkan slow vs fast-moving, bandingkan ritel vs grosir, dan hitung berapa hari stok cukup (stok ÷ kecepatan jual)~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~Mulai kumpulkan snapshot stok harian ABS selama beberapa hari, karena tabelnya hanya menyimpan kondisi saat diunduh~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~**M5:** unduh `sales_train_evaluation.csv`, `calendar.csv`, dan `sell_prices.csv`. Pakai subset (misalnya kategori FOODS di 1–2 toko).~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~Buat model demand forecast (statsforecast), lalu pakai untuk fitur ramalan model risiko (sekarang: laju harian × horizon). Dipindah dari Tahap 9.~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~Jadikan 28 hari terakhir sebagai data uji, lalu bandingkan model forecast dengan baseline sederhana. Hasilnya menjadi angka akurasi untuk Bagian 6 proposal.~~ **Dibatalkan bersama Tahap 10.**
- ⛔ ~~Uji logika Death Spiral di M5 (penjualan nol karena stok habis vs karena tidak ada peminat)~~ **Dibatalkan bersama Tahap 10.**

### Tahap 11 — Demo & pitch 🟡

**Final: Sabtu 31 Okt 2026, tatap muka, 15 menit termasuk tanya jawab, berbahasa Inggris.** Demo live diutamakan dan harus memperlihatkan loop agentic (plan → reason → act/tool → review) dengan human-in-the-loop. Buka deck dengan diagram arsitektur dan pakai alur Problem → Solution → Impact.

Alur demo yang disarankan (mengikuti skop demo di Bagian 4 proposal: lonjakan SKU A vs stagnasi SKU B):

| # | Langkah | Dataset | Paket | Isi |
|---|---|---|---|---|
| 1 | Ingestion | Bibitor | Minimal | CSV → S3 → RDS/DuckDB, rekonstruksi stok harian, Data Confidence Score |
| 2 | Penalaran | Bibitor | Minimal | Hitung Vs dan lead time, pilih SKU A dan SKU B di cabang yang sama |
| 3 | SKU A: draf PO | Bibitor + Backorders | Kuat | Skor risiko + tanggal stok habis → draf PO ke SAP (mock), menunggu 1-Click Approval |
| 4 | SKU B: Hold Reorder | Bibitor + Instacart | Minimal | Tidak ada peran komplementer → Hold Reorder, exploration budget tetap dialokasikan |
| 5 | Capital Reallocation | Bibitor | Minimal | Modal dari SKU B direkomendasikan untuk SKU A, dalam Rupiah |
| 6 | Uji guardrail | Online Retail II | Kuat | Injeksi pesanan borongan → filter >3σ menahan PO, circuit breaker aktif |
| 7 | ~~Slide validasi~~ | ~~Montgomery + M5~~ | ~~Maksimal~~ | Dibatalkan bersama Tahap 10; validasi data riil masuk roadmap Fase 2 |

- [x] Data dan skenario langkah 1–5 siap di toko 74: agent menahan reorder Ciroc, menyusun draf PO Bacardi Gold dan Smirnoff, dan menyarankan realokasi; data dibersihkan dengan `python -m agent.reset_demo` (lihat `docs/deploy.md`).
- [x] Langkah 6 siap: `python -m agent.skenario_runaway` (juga skenario selisih stok `agent.skenario_selisih_stok`). Langkah 7 dibatalkan bersama Tahap 10.
- [x] **Selesai 22 Okt:** `POST /sku/{id}/stok-fisik` (hitung fisik, label simulasi) menurunkan Data Confidence menjadi 1 − |selisih| / stok sistem; di bawah 0,8 draf PO baru ditahan `DATA_CONFIDENCE_RENDAH`, draf lama tidak bisa disetujui (409), dan Hold juga ditolak, sampai `DELETE /sku/{id}/stok-fisik` (audit selesai). Skrip demo `python -m agent.skenario_selisih_stok --store 74` (akhiri dengan `--audit-selesai`). Uji dengan agent asli: Bacardi Gold stok sistem 43, fisik 32 → confidence 1,00 → 0,74 → draf PO ditahan, Smirnoff tetap DRAFT. 5 test baru (73 lulus). Skenario ini dibutuhkan karena data Bibitor asli konsisten sempurna, sehingga fitur mitigasi inakurasi data tidak akan pernah terlihat tanpa injeksi selisih.
- [ ] Gladi demo live end-to-end dengan timer (15 menit sudah termasuk tanya jawab)
- [ ] Slide arsitektur (dibuka paling awal; diagram opsi 4 dan loop agentic sudah ada di `docs/arsitektur.md` dan `docs/Komponen_Teknologi_Rexa.pdf`): dashboard di Amplify, API + guardrail + tiruan SAP di Lambda (Function URL), state di EFS, agent Strands di Amazon Bedrock AgentCore Runtime dengan Claude Sonnet 4.6 (dibangunkan Lambda Copilot), chatbot dan Agent Jaringan di Lambda Copilot. Tekankan bahwa kode agent yang sama berpindah dari laptop (Ollama) ke Bedrock lalu ke AgentCore tanpa mengubah dashboard maupun API, jadi tidak terikat ke satu penyedia model, dan data stok bisa tetap di infrastruktur sendiri.
- [ ] Slide "Sumber data per modul"; transparansi seperti ini menambah kredibilitas di depan juri
- [ ] Cantumkan atribusi dan catatan lisensi setiap dataset
- [ ] Slide roadmap: pilot **Fase 2** dengan data cabang riil dan kalibrasi ulang model, lalu **Fase 3** berupa audit fisik lewat foto rak (dataset gambar produk ritel Indonesia)
- [ ] Rekam video demo cadangan
- [x] Kirim pertanyaan mentoring sebelum **Senin 19 Okt 2026, 16.00 WIB** (dikirim 18 Okt, dijawab 19 Okt; ringkasannya di bagian Ketentuan Lomba)
- [ ] Ikuti Zoom deep-dive teknis 30 menit (diusulkan Rabu 22 Okt 2026 siang/sore WIB, jadwal dari panitia). Bawa diagram arsitektur dan pertanyaan soal database state di Lambda dan AgentCore.
- [ ] Pakai Kiro secara nyata untuk sebagian pekerjaan (misalnya Tahap 7 atau 8), simpan spec dan steering-nya (`.kiro/`) di repo, dan siapkan cuplikan singkat Kiro untuk demo. **Kemajuan 24 Okt:** steering docs (`.kiro/steering/product.md`, `tech.md`, `structure.md`) dibuat lewat fitur "Project steering files" Kiro, lalu dikoreksi (Bedrock tidak dipakai, deploy dashboard hanya ke Amplify, aturan data dashboard). Redesain UI 23 Okt juga memakai Kiro (mode chat). **Sisa:** satu Spec (`.kiro/specs/`) untuk pekerjaan nyata dan cuplikan layar Kiro untuk demo. Penyambungan dashboard ke API sudah selesai (24 Okt), jadi Spec bisa dipakai untuk pekerjaan kecil berikutnya, misalnya versi bahasa Inggris tampilan dashboard untuk presentasi.
- [ ] Siapkan deck dan naskah presentasi dalam bahasa Inggris, lalu serahkan demo + slide sebagai artefak pada hari final
- [ ] Putuskan bahasa output agent dan dashboard untuk demo (presentasi berbahasa Inggris, sedangkan ringkasan agent saat ini berbahasa Indonesia)

---

## Catatan & Risiko

- **Lisensi Bibitor:** di Kaggle tertulis Apache 2.0, tetapi materi aslinya milik HUB of Analytics Education untuk keperluan pendidikan. Aman untuk hackathon non-komersial dengan atribusi; **jangan dipakai untuk pilot komersial**.
- **Keterbatasan Bibitor:** stok hanya berupa snapshot awal dan akhir periode, tidak ada ID keranjang, dan periodenya hanya 12 bulan (2016). **Penjualan harian hanya lengkap untuk Januari 2016** (file terpotong di batas baris Excel), dan datanya terlalu konsisten sehingga terlihat sintetis. Sampaikan ini dengan jujur di slide "Sumber data per modul". Deskripsi di halaman Kaggle-nya menyebut perusahaan manufaktur; abaikan, isinya tetap data Bibitor.
- **Instacart:** file kompetisi aslinya tidak bisa diunduh lewat API Kaggle, jadi dipakai mirror. Mirror tersebut berlabel CC0, tetapi data aslinya dirilis Instacart dengan syarat non-komersial. Cantumkan Instacart sebagai sumber.
- **Mapping jenis Bibitor ↔ Instacart** berbasis kata kunci, sehingga sebagian SKU (7% volume spirits, 18% volume wine) tidak terpetakan dan berstatus `TIDAK_DIKETAHUI`. Agent tidak boleh hold otomatis untuk SKU tersebut. Vodka berada di dekat ambang (1,46× vs 1,5×), jadi kalau ditanya juri, jelaskan bahwa ambangnya ditetapkan di awal dan bisa dikalibrasi ulang dengan data cabang riil.
- **Product Backorders:** kelasnya sangat tidak seimbang (0,67% backorder), domainnya suku cadang (bukan ritel), dan lisensi mirror yang dipakai tertulis *unknown*; cantumkan sebagai data edukasi. Model sudah divalidasi di data test Backorders (PR-AUC 0,227), **tetapi belum divalidasi di data minuman** karena Bibitor tidak punya catatan stok habis. Probabilitasnya juga di bawah nilai sebenarnya, jadi yang ditampilkan hanya skor peringkat. Kalau juri bertanya, jawab: "pra-latih, urutan risikonya masuk akal (REORDER 3× AMAN), kalibrasi di pilot Fase 2".
- **Online Retail II:** periode 2009–2011 dan pelanggannya grosir di Inggris; yang dipakai hanya **rasio** lonjakan borongan (18,5×), bukan angka penjualannya.
- **Montgomery County:** data tidak dipecah per toko (penjualan ritel adalah gabungan semua toko, stok adalah total per item) dan lisensinya tidak dicantumkan.
- **Jangan menggabungkan baris antar-dataset** seolah-olah satu perusahaan. Periodenya berbeda (Bibitor 2016, Online Retail II 2009–2011), begitu juga negara dan mata uangnya.
- **SAP:** sandbox api.sap.com hanya untuk membaca data, jadi pembuatan PO memakai mock. SAP BTP trial berlaku 90 hari dan akun harus login minimal sekali setiap 30 hari.
- **Biaya AWS:** pasang AWS Budgets sejak awal.
- **Akun AWS lama ("pengalaman baru", proyek Do the Thing) ditinggalkan** atas saran mentor (19 Okt 2026): region terkunci di Sydney, tidak mendukung Kiro, serta Marketplace dan cross-region dibatasi. Semua resource final dibuat di akun standar baru.
- **LLM lokal (Ollama):** demo bergantung pada laptop ber-GPU (RTX 5070 Ti, VRAM 12 GB); anggota tim tanpa GPU besar bisa memakai `qwen3:8b`, dengan respons lebih lambat. Kualitas penalaran model 14B di bawah model cloud kelas atas, jadi angka dan keputusan tetap harus datang dari tools API (guardrail di kode), bukan dari tebakan model. Unduhan model ±9 GB.
- **Paket AWS di akun baru:** Free plan tetap memblokir Claude (Marketplace) dan kredit promosi, termasuk kredit Student Rewards, dan otomatis ditutup saat kreditnya habis atau setelah 6 bulan. Paid plan membuka semuanya, tetapi pemakaian di atas Free Tier/kredit ditagih ke kartu. Pasang AWS Budgets sebelum membuat resource, dan matikan resource yang menganggur.
- **Jadwal:** final Sabtu 31 Okt 2026, 12 hari dari 19 Okt. Deploy AWS (Tahap 8) bergantung pada akun baru yang belum dibuat, dan dashboard (Tahap 7) masih menunggu desain. Kalau waktu mepet, mentor mengizinkan sebagian demo berjalan lokal; video cadangan tetap disiapkan.
- **Bahasa:** presentasi final berbahasa Inggris, sedangkan ringkasan agent, label API, dan istilah di kode berbahasa Indonesia.
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
| Product Backorders (mirror lengkap, dipakai) | Kuat | https://www.kaggle.com/datasets/chandanareddy12/back-order-prediction |
| Can You Predict Product Backorders? (kompetisi asli, untuk atribusi) | Kuat | https://www.kaggle.com/c/untadta |
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
| 17 Okt 2026 | **Tahap 4 selesai.** FastAPI di `api/` dengan 6 tools agent, endpoint approval, audit log, dan 6 guardrail di kode (batas harian, 3σ, circuit breaker, idempotency key, status default Draft, Data Confidence). 21 test API baru (total 39) dan uji langsung alur demo toko 74. Syarat basis tren ≥ 90 unit ditambahkan setelah uji langsung menemukan tren palsu dari produk baru. |
| 17 Okt 2026 | Langkah persiapan Tahap 5 ditulis (akses Claude di Bedrock, user IAM, AWS CLI, kredensial, biaya) beserta skrip cek `python -m agent.cek_bedrock`. Model dipilih: Claude Opus 5.5 (`global.anthropic.claude-opus-5-5`) di `us-east-1`. |
| 17 Okt 2026 | Langkah persiapan Tahap 5 direvisi: akun AWS tim ternyata memakai "pengalaman baru" AWS (proyek "Do the Thing", region Sydney, tanpa root/user IAM konsol, paket gratis dengan kredit $100). Kredensial memakai `aws login`; skrip cek sekarang mencoba 4 kombinasi region + inference profile dan menyimpan yang berhasil ke `.env`. |
| 17 Okt 2026 | Claude di Bedrock ternyata diblokir paket gratis (halaman *"Free account plan access limitations"*). Tim memilih **opsi A: Amazon Nova 2 Lite** di Bedrock, tetap gratis dan tetap di AWS. Skrip cek dan `agent/config.py` diubah ke kandidat Nova; Claude tetap bisa dites lewat `--claude`. |
| 17 Okt 2026 | Panitia (mentor AWS) membalas: Ollama/Gemini **boleh** untuk prototipe, tapi solusi final harus berjalan di AWS (AWS + SAP + Kiro = poin tambahan); verifikasi akun butuh kartu kredit Visa/Mastercard + email kampus; pertanyaan mentoring paling lambat Senin 19 Okt 16.00 WIB. Ketentuan dicatat di bagian "Ketentuan Lomba". |
| 17 Okt 2026 | **Rencana dirombak: LLM agent memakai Ollama (Qwen3 14B) di laptop.** `agent/config.py` mendapat `CHIBIREX_LLM_PROVIDER` (default `ollama`), `agent/llm.py` membuat model Strands, dan skrip cek baru `python -m agent.cek_llm` menguji pemanggilan tool. Paket `ollama` ditambahkan ke requirements. Langkah akun AWS dipindah dari Tahap 5 ke Tahap 8 (deploy, wajib untuk final). |
| 17 Okt 2026 | **Persiapan Tahap 5 selesai.** Ollama 0.40.5 + `qwen3:14b` terpasang, `python -m agent.cek_llm` lulus (3,2 dtk). Uji model menemukan Qwen3 14B salah membandingkan angka sendiri (0/5), tetapi 5/5 benar kalau tool memberi keputusan jadi. Pengaturan: konteks 8K (100% GPU), *thinking* mati. Skrip cek sekarang memeriksa kebenaran kesimpulan model. |
| 17 Okt 2026 | **Tahap 5 selesai.** Paket `agent/` (6 tools Strands, system prompt, `python -m agent.run`), endpoint API baru (`list_prioritas`, `agent-runs`, label `arah_tren`), guardrail satu draf PO per SKU, dan pembatasan tindakan agent ke daftar prioritas di kode. Uji langsung toko 74: semua keputusan benar dalam 29,7 detik; percobaan model membuat PO untuk SKU "turun" ditolak guardrail. Total 50 test lulus. |
| 18 Okt 2026 | **Tahap 6 inti selesai.** Tiruan SAP `sap_mock/` (OData V2 `API_PURCHASEORDER_PROCESS_SRV`: path URL sama, token CSRF, validasi, nomor PO 45xxxxxxxx) ter-mount di API `/sap`; `api/sap.py` menyusun payload; approve membuat PO di SAP dan menyimpan `sap_po_number` (SAP gagal → PO tetap DRAFT); pratinjau payload `GET /purchase-orders/{id}/sap-payload`; migrasi kolom otomatis. 57 test lulus; uji langsung agent → approve → PO 4500000001. Catatan: V2 deprecated, pengganti OData V4 `CE_PURCHASEORDER_0001`. |
| 18 Okt 2026 | **Tahap 9 selesai.** `engine/risiko.py`: model LightGBM risiko stok habis dari Product Backorders (mirror lengkap 1,69 juta baris), PR-AUC 0,227 vs aturan cover 0,078; skor untuk setiap SKU Bibitor di tabel `risiko_stockout` (TINGGI 11.671, SEDANG 69.847, RENDAH 194.871) dan tampil sebagai Confidence Score di API + ringkasan agent. `engine/borongan.py`: 87% produk Online Retail II pernah mengalami lonjakan >3σ, median 18,5×. Skenario `python -m agent.skenario_runaway`: 3 PO borongan ditahan → circuit breaker terbuka → PO normal ikut ditahan. Bug fitur rasio (`least()` mengabaikan NULL) ditemukan dan diperbaiki. 62 test lulus. Model forecast statsforecast dipindah ke Tahap 10. |
| 19 Okt 2026 | Mentor AWS menjawab pertanyaan mentoring (ringkasan di bagian Ketentuan Lomba). Final **Sabtu 31 Okt**, tatap muka, 15 menit, bahasa Inggris, demo live. Rencana Tahap 8 dirombak: akun "pengalaman baru" ditinggalkan dan diganti akun standar baru (email kampus); LLM final Bedrock lewat Strands (Nova + Claude) di AgentCore Runtime; API di Lambda + API Gateway; tanpa EC2. Tiruan SAP dikonfirmasi diterima. Tugas Kiro (spec + steering di repo) ditambahkan ke Tahap 11. Zoom deep-dive diusulkan Rabu 22 Okt. |
| 20 Okt 2026 | Desain dashboard **Rexa** (React + Vite + Tailwind) masuk dari tim; ditinjau: semua fitur proposal ada dan build lulus, tetapi datanya masih tiruan. Tim memutuskan nama produk **Rexa** dan penyambungan dashboard lewat **Kiro**. Backend menambah CORS, `GET /stores`, `GET /stores/{store}/ringkasan` (Health Score toko 74 = 69), dan agent yang bisa dijalankan dari dashboard (`POST /agent-runs/mulai`, langkah dipantau lewat `GET /agent-runs/{run_id}`). Kontrak API untuk dashboard ditulis di `docs/api-dashboard.md`. 68 test lulus. |
| 20 Okt 2026 | Front-end dipindah ke `dashboard/` dan `node_modules` dikeluarkan dari git. **Inti demo dashboard tersambung ke API:** klien `src/lib/api.js`, panel agent (Plan → Reason → Act → Review, langkah tampil selagi agent berjalan), kartu PO menunggu persetujuan, dan 1-Click Approval dengan PO asli. Diuji di browser dengan agent asli: 2 draf PO → approve → SAP PO #4500000001. Sisa dashboard dilanjutkan teman tim lewat Kiro. |
| 22 Okt 2026 | Tim men-deploy API ke **AWS Lambda** (Function URL, Sydney) dan dashboard ke **Vercel** (`chibirex-dashboard.vercel.app`, build sudah mengarah ke URL Lambda). Hasil cek: API menjawab dengan data asli, tetapi **CORS menolak domain Vercel** ("Disallowed CORS origin"), jadi bagian dashboard yang memakai API belum bisa tampil. Perbaikan: isi `CHIBIREX_CORS_ORIGINS` di Lambda. Catatan lanjutan: agent belum bisa jalan di Lambda (butuh Bedrock + AgentCore), state SQLite di Lambda tidak bertahan antar-instance, dan Vercel bukan AWS. |
| 22 Okt 2026 | Diagram arsitektur (target AWS + loop agentic) ditulis di `docs/arsitektur.md` (Mermaid, tampil di GitHub; sudah dicek ter-render). **Skenario selisih stok** selesai: hitung fisik menurunkan Data Confidence, guardrail menahan draf PO baru, approval draf lama, dan Hold sampai audit selesai; skrip `agent.skenario_selisih_stok`; diuji dengan agent asli (Bacardi Gold 1,00 → 0,74 → PO ditahan). 73 test lulus. |
| 22 Okt 2026 | CORS di Lambda sudah diisi tim; dashboard Vercel kini memuat data dari API Lambda tanpa galat (dicek di Edge headless). Pengaman baru: di Lambda, `POST /agent-runs/mulai` menjawab 503 `AGENT_BELUM_TERSEDIA` (agent lokal tidak bisa jalan di sana) sampai agent di-deploy ke Bedrock AgentCore. 74 test lulus. |
| 22 Okt 2026 | **Deploy Lambda dirapikan dan dijalankan ulang dari repo** (akses CLI ke akun tim lewat `aws login --profile rexa`). Isi image lama dibaca dari ECR: perubahan tim (CORS, state di `/tmp`, handler Mangum) dipindahkan ke repo; jalur agent cadangan tanpa LLM dihapus. File baru: `Dockerfile`, `.dockerignore`, `requirements-lambda.txt`, `api/lambda_handler.py`, `deploy/deploy_lambda.ps1`. Perbaikan tambahan: tiruan SAP dipanggil di proses yang sama di Lambda (approve sebelumnya mengarah ke `127.0.0.1:8000`). Uji online: approve → SAP PO #4500000001. 77 test lulus. |
| 22 Okt 2026 | Cek Bedrock di akun proyek tim: semua kuota "tokens per day" Nova = 0 dan tidak bisa dinaikkan (ThrottlingException), Claude meminta formulir use case. **Tim memutuskan membuat akun AWS standar** (email kampus + kartu kredit) untuk Bedrock dan AgentCore; deploy dipegang pemilik akun baru. |
| 22 Okt 2026 | Akun standar `Rexa-ChibiRex` terbuat, tetapi **kartu ditolak** saat verifikasi pembayaran. Tim memilih **opsi 4**: tetap di akun proyek tim, API + dashboard + guardrail + tiruan SAP di AWS, LLM di laptop. Dikerjakan: mode antrian agent di API (`POST /agent-runs/mulai` → MENUNGGU, `POST /agent-runs/antrian/ambil`, `POST /agent-runs/{id}/langkah`, `GET /agent-runs/worker`, token `X-Worker-Token`), worker `agent/worker.py`, panel agent menampilkan status worker, **EFS** untuk state, Lambda ke VPC, **dashboard di AWS Amplify**, `POST /demo/reset` + `agent.reset_demo`, skrip `deploy\deploy_dashboard.ps1`, panduan `docs/deploy.md`. Uji online penuh: agent dari tombol dashboard → approve → SAP PO #4500000001. 81 test lulus. Catatan: satu test sempat mengosongkan PO di tiruan SAP lokal (`data/processed/sap_mock.sqlite`); test sudah diperbaiki agar hanya memakai file sementara. |
| 22 Okt 2026 | Item yang terhambat ditandai **dibatalkan** (dicoret, tidak dihitung): langkah akun standar dan Bedrock/AgentCore (kartu ditolak, kuota 0), integrasi SAP riil (opsional), dan seluruh Tahap 10 (waktu). Login CLI dan skenario demo langkah 1–6 dicentang karena sudah tercapai. |
| 23 Okt 2026 | Tim meredesain UI dashboard (commit "Redesain UI/UX Dashboard Rexa" dan "rapikan ui": header, sidebar, tabel, guardrail modal, realokasi, komponen baru `TopKeyMetricsRow`). Cek 24 Okt: build lulus dan panel agent tetap memakai antrian/status worker, tetapi **perubahan ini belum di-deploy ke Amplify** (Amplify masih build 22 Okt), **folder `.kiro/` belum ada**, dan Health Score, KPI, tabel, realokasi, skenario, serta chat Copilot **masih data dummy**. |
| 24 Okt 2026 | **Seluruh dashboard tersambung ke API** di atas desain baru tim: pilihan 80 toko, Health Score + rincian komponen, KPI, tabel Smart Reorder (PO/Hold/hitung fisik per SKU), detail Hold, Exploration Budget, Realokasi Modal, modal Audit & Guardrails (reset circuit breaker, audit stok, audit log asli), menu Skenario Uji (Runaway PO, selisih stok, audit selesai), dan Copilot yang menjawab dari data API. Data contoh (`mockData.js`, `copilotKnowledge.js`) dan klaim tanpa sumber dihapus. Diuji di Edge headless terhadap API lokal; build, oxlint, dan 81 test lulus. API online sudah punya semua endpoint yang dipakai. Dashboard di-deploy ulang ke Amplify hari yang sama (`deploy\deploy_dashboard.ps1`) dan dicek di Edge headless: data toko 74 termuat dari Lambda tanpa galat. Catatan deploy: `npm ci` sempat gagal `EPERM` karena dev server Vite sisa uji masih mengunci binding rolldown; selesai setelah prosesnya dimatikan. |
| 24 Okt 2026 | Worker agent bisa berjalan otomatis saat login Windows: `deploy\worker_otomatis.ps1` menaruh `Rexa Worker.vbs` di folder Startup, menjalankan worker tanpa jendela dengan log `logs\worker.log`, dan menjalankannya ulang kalau berhenti (`-Status` untuk cek, `-Hapus` untuk melepas). Ollama sudah otomatis jalan saat login. Tujuannya: tombol "Jalankan Agent" langsung bisa dipakai tanpa membuka terminal. `docs/deploy.md` diperbarui, termasuk menu Skenario Uji di dashboard. |
| 24 Okt 2026 | Worker otomatis terpasang dan agent online berhasil (45,7 dtk, 10 langkah). Ditemukan celah panel agent: setelah refresh, panel menampilkan run lama (gagal tanpa alasan) dan klik saat agent berjalan menampilkan galat 409. Diperbaiki: `409 AGENT_SEDANG_BERJALAN` kini membawa `run_id`, endpoint baru `GET /agent-runs/aktif`, daftar `GET /agent-runs` membawa `status` + `pesan`; panel ikut memantau run yang sedang berjalan dan menampilkan alasan gagal. 81 test lulus (assertion baru di `test_worker.py` dan `test_dashboard.py`); diuji di Edge headless terhadap API lokal mode antrian. Perlu deploy ulang API (Lambda) dan dashboard. |
| 24 Okt 2026 | **Jam simulasi**: data tidak lagi diam di 31 Des 2016. Waktu dimajukan lewat kontrol tanggal di header dashboard (+1/+7 hari, atau otomatis 1 hari per 10/30/60 detik dengan jeda; maks 90 hari). Setiap hari, stok SKU berkurang sesuai permintaan harian dari data (lognormal dengan rata-rata dan simpangan asli, deterministik per SKU per hari; stok tidak negatif lewat rumus Lindley), PO yang disetujui dan stok uji hold tiba setelah lead time vendor, dan reorder memakai stok gudang + dalam pengiriman (SKU yang barangnya di jalan tidak dipesan ulang). Implementasi `api/simulasi.py`: tabel sementara per request yang menutupi `sku_metrics`, jadi query lama tidak diubah; ±0,15–0,3 dtk per toko. Endpoint `GET /simulasi`, `POST /simulasi/maju`, `POST /simulasi/otomatis`; reset demo mengembalikan jam. 89 test lulus (7 test simulasi baru); diuji di Edge headless dengan data asli toko 74 (PO Bacardi disetujui → "dalam pengiriman" → tiba 9 Jan 2017; Health Score 69 → 68 setelah 7 hari). Perlu deploy ulang API dan dashboard. |
| 24 Okt 2026 | API dengan jam simulasi dan perbaikan panel agent **ter-deploy ke Lambda** (`GET /simulasi`, `GET /agent-runs/aktif` aktif; ringkasan toko 74 ±1,1 dtk). Deploy dashboard ke Amplify gagal saat upload zip ("connection was closed": Windows PowerShell 5.1 di proses baru tidak memakai TLS 1.2) dan meninggalkan job PENDING yang memblokir deploy berikutnya. `deploy_dashboard.ps1` kini mengaktifkan TLS 1.2, mencoba upload 3 kali, dan membatalkan job-nya sendiri kalau tetap gagal. |
| 24 Okt 2026 | Perbaikan UX header: empat dropdown (toko, level otonomi, skenario uji, waktu simulasi) sebelumnya dibuka dengan hover CSS dan tertutup saat kursor melewati celah ke menu, sehingga isinya tidak bisa dipilih (dan tidak bisa dipakai di layar sentuh). Sekarang dibuka dengan klik; tertutup saat klik di luar, Esc, atau klik tombolnya lagi; menu waktu simulasi tetap terbuka supaya bisa "+1 hari" berkali-kali. Diuji di Edge headless dengan gerakan dan klik mouse sungguhan. |
| 24 Okt 2026 | Tombol **Kembali ke 31 Des 2016** di menu waktu simulasi (`POST /simulasi/kembali`): tanggal dan stok kembali ke data awal tanpa menghapus PO, hold, jejak agent, dan audit log (berbeda dengan `reset_demo` yang menghapus semuanya). Barang yang sudah tiba menjadi riwayat; barang yang masih di jalan tetap tiba dengan sisa lead time; tanggal review hold ikut mundur. 90 test lulus; diuji di browser (Bacardi kembali ke stok 43, PO Smirnoff yang masih di jalan tetap tiba 9 Jan 2017, Health Score kembali 69). |
| 25 Okt 2026 | **Claude di Amazon Bedrock bisa dipakai** lewat API key Bedrock (`AWS_BEARER_TOKEN_BEDROCK` di `.env`, tidak perlu `aws login`). Uji di Sydney: Claude Sonnet 4.6 (`au.anthropic.claude-sonnet-4-6`) dan Opus 4.6 berhasil; Sonnet 4.5 butuh formulir use case Anthropic; model 5.5 belum tersedia untuk akun ini. Agent Rexa dengan Sonnet 4.6 terhadap API lokal: 17–21 dtk untuk 8 tool (Ollama 45–60 dtk), keputusan sesuai prosedur (hold Ciroc, Capt Morgan tidak di-hold karena komplementer, Buchanans ke review manusia, 2 draf PO, realokasi), ±17 ribu token input per run. Prompt ditambah aturan format ringkasan (teks biasa, satu baris per SKU, tanpa tabel/emoji) karena panel dashboard hanya merender teks dan tebal. `agent.cek_bedrock --claude` memakai kandidat model yang tersedia dan menerima API key. |
| 25 Okt 2026 | Worker otomatis di laptop dialihkan ke Claude Sonnet 4.6 (Bedrock) dan aktif; dashboard di-deploy ulang ke Amplify (label "Worker agent di laptop", footer Claude Sonnet 4.6) dan dicek online tanpa galat. Lambda sudah memuat fitur "Kembali ke 31 Des 2016". |
| 25 Okt 2026 | **Chatbot Copilot memakai Claude** (tidak lagi dummy). Lambda baru `rexa-copilot` (zip Python 3.12, di luar VPC, role yang sama dengan Lambda API, tanpa API key) menjawab `POST /tanya` dengan Claude Sonnet 4.6 lewat Bedrock Converse + 9 tool **baca saja** ke API Rexa (prioritas, SKU, detail SKU, substitusi, PO, hold, realokasi, guardrail, riwayat agent); ringkasan toko dan tanggal simulasi ikut di prompt. Lambda API tidak dipakai karena ada di VPC tanpa internet keluar. Prompt diberi glosarium field (misalnya `tren_beli` adalah kelipatan, bukan persen), aturan bahasa (jawab sesuai bahasa pengguna), dan larangan menyimpulkan status tanpa cek. Widget mengirim riwayat 8 pesan terakhir; kalau Copilot gagal, kembali ke jawaban cepat dari data. Skrip `deploy\deploy_copilot.ps1`; `deploy_dashboard.ps1` otomatis memakai URL Copilot. 96 test lulus (6 test Copilot); diuji di browser dan online di Amplify. Satu pertanyaan ±5–12 ribu token masuk, 300–500 keluar (tagihan Bedrock di akun AWS tim). |
| 25 Okt 2026 | Supaya hemat, chatbot dipindah ke **Claude Haiku 4.5** (`au.anthropic.claude-haiku-4-5-20251001-v1:0`); agent tetap Sonnet 4.6. Cek ulang model Bedrock: selain Claude, akun tim kini juga bisa memakai Amazon Nova (kuotanya tidak lagi 0), Qwen3, DeepSeek, gpt-oss, dan Mistral. Uji tugas chatbot asli: Haiku 4.5 akurat dan mengikuti bahasa pengguna; Nova 2 Lite paling hemat tapi dangkal dan menjawab pertanyaan Inggris dalam bahasa Indonesia; Qwen3 235B salah menyimpulkan SKU paling berisiko. Lambda Copilot dan dashboard di-deploy ulang; model aktif terverifikasi. |
| 25 Okt 2026 | Rencana agent otomatis (review berkala mengikuti hari simulasi) dibatalkan atas keputusan tim; agent tetap dijalankan dengan tombol. Ditambah **mundur waktu simulasi**: tombol −1/−7 di menu tanggal (`POST /simulasi/mundur`, paling awal 31 Des 2016). Stok kembali persis seperti tanggal itu (diuji: +7, +7, −7 menghasilkan Health 68, modal tertahan, dan stok Smirnoff yang sama dengan hari 7 sebelumnya); PO dan hold yang dibuat sesudahnya tetap tercatat dengan jadwal tiba yang sama. Model body maju/mundur menjadi `GeserSimulasi`. 97 test lulus. |
| 25 Okt 2026 | **Rekap agent per hari simulasi**: menu baru "Rekap Agent" di dashboard (`GET /stores/{store}/rekap`). Per hari (terbaru dulu): run agent (jam nyata, status, model, jumlah tool, token, ringkasan yang bisa dibuka), Hold Reorder dan modal diselamatkan, draf PO dengan status sekarang dan pelanggaran guardrail, PO yang disetujui (nomor PO SAP) atau ditolak manajer; total di atas. Unduh CSV (pemisah `;` untuk Excel Indonesia) dan Cetak / Simpan PDF (halaman cetak terpisah, teks agent di-escape). Kolom baru hari simulasi: `agent_runs.hari_sim`, `purchase_orders.hari_dibuat/hari_diputuskan`, `holds.hari_dibuat`; data sebelum kolom ini dikelompokkan sebagai "Sebelum rekap per hari dicatat". 98 test lulus; diuji di browser dengan aktivitas dua hari simulasi. |
| 25 Okt 2026 | **Halaman "Semua Toko" + Agent Jaringan.** Menu baru di dashboard untuk melihat statistik semua toko tanpa berpindah toko: KPI jaringan (Health rata-rata 73,4, toko kritis, SKU perlu reorder, modal tertahan, draf PO, peluang transfer), grafik Health Score 80 toko (merah < 65, kuning 65-79, hijau ≥ 80), tabel yang bisa diurutkan dan dicari, dan daftar **transfer stok antar toko** (merek yang perlu reorder di satu toko padahal toko lain OVERSTOCK/DEADSTOCK; stok asal tidak dibagi melebihi kelebihannya). Klik toko di mana pun membuka dashboard toko itu. Endpoint `GET /jaringan/ringkasan` (Health Score sama persis dengan dashboard toko) dan `GET /jaringan/transfer`, di-cache per hari simulasi di tabel `cache_jaringan` (±0,5-0,9 dtk saat hitung). **Agent Jaringan** (`copilot/jaringan.py`, `POST /jaringan` di Lambda `rexa-copilot`, Claude Sonnet 4.6, hanya membaca): membaca ringkasan jaringan dengan beberapa urutan, membuka detail sampai 5 toko, membaca peluang transfer, lalu `tetapkan_prioritas` (3-5 toko dengan alasan dan tindakan, plus transfer pilihan); toko atau transfer yang tidak ada di data ditolak dan dikembalikan ke model, dan model dipaksa (`toolChoice`) melapor kalau berhenti tanpa laporan. Uji dengan data asli memperbaiki tiga kesalahan model lewat data, bukan hanya prompt: jumlah toko merah salah hitung (sekarang sebaran per warna ada di prompt), arah transfer tertukar (detail toko kini memuat `terima_dari_toko` / `kirim_ke_toko`), dan "Rp 63 M" untuk 63 juta (nominal wajib ditulis "juta"/"miliar"). Hasil akhir: 26, 81, 29, 36, 50 dengan alasan dan transfer sesuai data; ±21-28 dtk, ±23-34 ribu token masuk (±US$0,10-0,15 per analisis). Timeout Lambda Copilot 120 dtk. 107 test lulus (9 test baru); diuji di Edge headless (agent dari tombol, Buka toko, tanda laporan usang setelah +7 hari, lebar HP 390 px). Perlu deploy ulang API, Copilot, dan dashboard (rekap agent juga belum online). |
| 25 Okt 2026 | **Virtual HQ tersambung ke data asli.** Tim menambahkan `virtual_hq/` (kantor 2D Phaser 4 + React dengan NPC). Hasil cek: hampir semua angkanya karangan (Health Score 80 toko 84-95 padahal aslinya 52-82, region dan nama toko 46 dikarang, omset/transaksi di Smart TV, produk kopi dan sirup, batas PO Rp 50 juta padahal Rp 100 juta), fallback yang pura-pura sukses (agent "SELESAI" dan PO kopi tiruan saat API mati), nama field yang tidak cocok dengan API, alamat `localhost:8000` tertulis langsung, dan port 8080 belum diizinkan CORS. Disambungkan: klien bersama `virtual_hq/src/lib/api.js` (`VITE_API_URL`, `VITE_COPILOT_URL`); Pak Budi, Citra, Rian, Maya membacakan ringkasan toko, realokasi, guardrail, dan hitung fisik (`src/lib/npc.js`); Smart TV dan Ganti Cabang dari `/jaringan/ringkasan`; tanggal header memakai jam simulasi API (+1/+7, -1/-7, kembali); Meja Approval memakai draf PO toko yang diawasi; agent memakai run asli (ikut run yang sedang berjalan kalau 409) dan menampilkan GAGAL apa adanya; chat memakai Copilot; Doni mendeteksi krisis dari data (breaker terbuka, Health < 65, SKU naik risiko tinggi, modal tertahan > 40%) dengan aksi asli (reset breaker, tugaskan agent). Daftar toko statis dibuat ulang dari DuckDB; `log.js` (ping ke server Phaser) dan modul data karangan dihapus; bubble agent kini tampil di bawah Rexa saat ruang di atasnya tidak cukup. CORS API menambah port 8080. Diuji di Edge headless dengan API lokal: dialog NPC, Smart TV, regional (4 toko kritis), +7 hari (07 Jan 2017 di API dan header), Crisis Hub (Bacardi Gold Rum stok 0), approve PO sungguhan (SAP 4500000001), chat Copilot, agent tanpa worker (GAGAL dengan alasan), dan API mati (setiap panel menulis galat). 107 test backend lulus; build Virtual HQ lulus. |
| 25 Okt 2026 | **Virtual HQ disatukan dengan dashboard web.** Tombol **Mode Virtual HQ** di sidebar dashboard membuka kantor 2D untuk toko yang sedang dibuka (`/hq/index.html?store=..`), dan tombol **Dashboard** di header game (drawer di HP) kembali ke toko yang sama. `deploy\deploy_dashboard.ps1` kini mem-build Virtual HQ dengan alamat API dan Copilot yang sama lalu memasangnya di `/hq/` pada domain Amplify dashboard, jadi origin-nya sama dan CORS tidak perlu diubah. Status API di drawer HP game kini memakai hasil cek asli. Diuji dengan build produksi yang disajikan dari satu origin: dashboard toko 26 → Virtual HQ toko 26 (API ONLINE) → kembali ke dashboard toko 26, dan lebar HP 390 px. **Ter-deploy hari yang sama** (Lambda API dengan `/jaringan` dan rekap, Lambda Copilot dengan Agent Jaringan dan timeout 120 dtk, dashboard + Virtual HQ di Amplify) dan dicek di situs online: tombol membuka `/hq/index.html?store=74`, Pak Budi 69/100 peringkat 66 dari 80 dari API online, kembali ke dashboard berhasil. Catatan deploy: `docker login` ke ECR sempat gagal 400 karena pipe PowerShell 5.1 merusak token ECR yang panjang; `deploy_lambda.ps1` kini mem-pipe lewat `cmd /c`. |
| 25 Okt 2026 | Perbaikan Virtual HQ: setelah agent dijalankan, pemain tidak bisa bergerak lagi. Penyebab: `App.jsx` menghapus semua timer agent (polling dan hitung mundur pencairan pemain) di cleanup efek listener, yang terpasang ulang setiap handler berganti; saat agent selesai, data toko dimuat ulang, `currentStore` berganti, dan hitung mundurnya ikut terhapus sehingga bubble tidak pernah tertutup. Timer kini hanya dibersihkan saat App dilepas. Direproduksi dan diuji di Edge headless (agent GAGAL tanpa worker → setelah 8 dtk kembali STANDBY). Ditambah jalan keluar selama agent bekerja: tombol **✕ Esc** di bubble (atau Esc) menutup bubble dan mencairkan pemain, agent tetap dipantau di latar (header "REXA IN PATROL · LIHAT" bisa diklik untuk membuka bubble lagi), dan hasil akhirnya tetap muncul tanpa membekukan pemain lagi. Diuji: pemain tidak bergerak saat bubble terbuka, bergerak setelah Esc. |
| 25 Okt 2026 | Virtual HQ: bubble agent **tidak lagi tertutup otomatis**. Hasil agent (ringkasan atau alasan gagal, langkah terakhir) tetap terbuka sampai pemain bergeser, menekan ✕, atau Esc, dan tetap tersimpan setelah ditutup: header menampilkan "✅ HASIL AGENT / ⚠️ AGENT GAGAL · LIHAT" untuk membukanya lagi. Saat game dibuka atau toko diganti, run terakhir toko itu dibaca dari `GET /agent-runs` (jadi tetap ada setelah refresh), dan run yang sedang berjalan dari `GET /agent-runs/aktif` ikut dipantau. Tombol **↻ Jalankan Ulang** di bubble memulai run baru. Selama agent bekerja pemain tetap dibekukan, tetapi Esc/✕ melepaskannya dan agent lanjut di latar; kalau selesai di latar, bubble tidak muncul sendiri. Diuji di Edge headless: hasil tetap terbuka 15 dtk setelah selesai, tertutup saat pemain bergeser, dibuka lagi dari header, Jalankan Ulang, Esc saat berjalan, dan hasil terakhir muncul lagi setelah halaman dimuat ulang. |
| 25 Okt 2026 | Virtual HQ: alur agent dan semua panel laporan disamakan sesuai permintaan tim. Agent: dijalankan → pemain tetap bebas bergerak (tidak dibekukan) → selesai → log bisa dibuka kapan saja dari header ("HASIL AGENT TOKO 74 · LIHAT") → agent baru dijalankan lagi hanya lewat **Jalankan Ulang** (E di dekat Rexa membuka log kalau sudah ada; "Tugaskan Agent" di Crisis Hub memakai event terpisah `jalankan-agent`). Staf (Maya, Citra, Rian, Pak Budi), Doni, dan Smart TV kini panel melayang tanpa latar dan tanpa membekukan pemain; tertutup saat pemain pergi, ✕, atau Esc; laporan tersimpan per toko dan langsung tampil saat dibuka lagi; data baru lewat **Muat Ulang**/**Periksa Ulang**, dengan peringatan kalau tanggal simulasi sudah berubah. Di HP panel pindah ke bawah header supaya joystick tetap terpakai. Diuji di Edge headless: bergerak selama agent bekerja, log tersimpan dan dibuka lagi, Jalankan Ulang, laporan Pak Budi tampil lagi tanpa memuat, peringatan setelah +1 hari lalu Muat Ulang (69 → 68), Doni dan Smart TV tertutup saat pemain pergi, lebar HP 390 px. |
| 25 Okt 2026 | **Virtual HQ mode Semua Toko**, padanan halaman Semua Toko di dashboard. Kantor yang sama, tetapi semua untuk 80 toko: Rexa menjalankan Agent Jaringan (alur sama: bebas bergerak, laporan tersimpan, Jalankan Ulang; laporan dipakai bersama dashboard lewat `rexa.laporanJaringan.v1`; "Buka toko" masuk ke toko prioritas), Pak Budi Health jaringan dan toko merah, Citra modal tertahan dan transfer stok, Rian breaker dan draf PO jaringan, Maya total reorder/risiko/overstock/deadstock, Doni toko di zona merah (aksi Jalankan Agent Jaringan), Smart TV KPI dan sebaran 80 toko, Meja Approval draf PO semua toko. Masuk lewat `?mode=jaringan` (sidebar dashboard saat di halaman Semua Toko, tombol **Buka di Virtual HQ** di halaman itu, tombol 🌐 SEMUA TOKO di header game, atau kartu di Ganti Cabang); tombol Dashboard kembali ke `/?tab=jaringan`. Diuji ujung ke ujung dengan build produksi satu origin dan Copilot lokal (Sonnet): laporan staf jaringan, Doni 4 toko merah, Agent Jaringan dari Doni sambil berjalan (5 toko prioritas), Buka toko 26, kembali ke Semua Toko, dan laporan yang sama tampil di dashboard. |
| 25 Okt 2026 | Smart TV Virtual HQ: di bawah grafik Health terendah ditambah **Health tertinggi** (7 toko teratas) dan **Health semua toko** (80 batang urut terendah → tertinggi, garis batas merah 65, toko yang disorot ditulis di bawah grafik). Klik batang mana pun pindah ke toko itu. Berlaku di mode toko dan mode Semua Toko. Diuji di Edge headless: sorot batang terakhir menampilkan Toko 72 HARDERSFIELD (82), klik membuka Toko 72. |
| 25 Okt 2026 | Virtual HQ di HP/tablet: petunjuk tombol keyboard tidak ditampilkan saat kontrol sentuh aktif (aturan sama dengan munculnya joystick dan tombol TAP, `src/utils/perangkat.js`). Label di peta menjadi "[Inspeksi Smart TV]", "[Review PO]", "[Analisis Toko] [Chat]" (tanpa "Tekan E"/"E:"/"C:"); keycap E/C di header dan tombol aksi disembunyikan; "✕ Esc" menjadi "✕" dan petunjuk Esc di bubble, panel, Meja Approval, Ganti Cabang, dan Simulasi Waktu disesuaikan. Diuji di Edge headless: HP 390 px dan tablet 1024 px dengan emulasi sentuh tanpa keycap, desktop tetap. |
| 25 Okt 2026 | Virtual HQ di HP/tablet: tombol melayang "Analisis Toko" / "Chat Copilot" di dekat Rexa dan "Review PO Toko" di meja manajer tidak lagi ditampilkan. Di layar sempit tombol itu menutupi label peta dan terpotong di tepi layar, padahal aksinya sama dengan tombol TAP dan tombol HP di pojok kanan bawah. Ditemukan juga bahwa satu ketukan TAP memulai agent toko berkali-kali (tombol TAP mengirim E dan beberapa event cadangan, semuanya lolos sebelum state `agentRunning` berubah). Penjaganya kini memakai ref, jadi satu ketukan hanya memulai satu run. Diuji di Edge headless: HP 390 px dengan emulasi sentuh tanpa tombol melayang, TAP membuka bubble agent dengan satu percobaan run, desktop tetap menampilkan tombol E/C. |
| 26 Okt 2026 | **Agent toko bisa berjalan tanpa laptop: Amazon Bedrock AgentCore Runtime** (ter-deploy hari yang sama, lihat catatan di akhir). Agent Strands yang sama dijalankan oleh `agent/agentcore.py` (`BedrockAgentCoreApp`): runtime menjawab panggilan seketika, lalu di latar mengambil satu tugas dari antrian API dengan token worker (fungsi `kerjakan_satu` dipakai bersama worker laptop, nama pengambil `bedrock-agentcore`) sementara `/ping` melapor HealthyBusy. Pemicunya Lambda Copilot (`POST /agent`, `copilot/agentcore.py`, `InvokeAgentRuntime` dengan sesi baru per run), karena Lambda API ada di VPC tanpa akses keluar dan browser tidak punya kredensial AWS; dashboard dan Virtual HQ memanggilnya tepat setelah tugas masuk antrian. Worker laptop tetap cadangan (tugas diambil yang lebih dulu meminta). API: `CHIBIREX_AGENTCORE=1` membuat `GET /agent-runs/worker` membawa `agentcore: true` (dashboard menulis "Agent berjalan di Amazon Bedrock AgentCore", Smart TV "BEDROCK AGENTCORE"), pesan gagal menunjuk AgentCore, dan batas tunggu tugas 30 → 60 dtk untuk cold start sesi. `deploy\deploy_agent.ps1`: kemas `agent/` + dependensi (`requirements-agentcore.txt`) untuk Linux ARM64 dengan `uv` (zip ±30 MB, Python 3.13, tanpa container), unggah ke S3, role `rexa-agentcore-role` (hanya model Bedrock, kode di S3, log), runtime `rexa_agent_toko` (sesi ditutup 2 menit setelah menganggur), izin `InvokeAgentRuntime` untuk role Lambda, deploy ulang Copilot dengan ARN runtime, tandai Lambda API, lalu uji tanpa menjalankan agent. 112 test lulus (5 test baru). Uji lokal ujung ke ujung: runtime dijalankan sebagai file seperti di AgentCore, API lokal mode antrian dengan state sementara; tugas diambil 2 dtk setelah dibangunkan, agent SELESAI dengan Claude Sonnet 4.6 (8 tool), `/ping` kembali Healthy. **Deploy:** AgentCore tersedia di `ap-southeast-2` untuk akun tim; runtime `rexa_agent_toko` READY, Copilot dengan `POST /agent`, Lambda API (kode baru + `CHIBIREX_AGENTCORE=1`), dan dashboard + Virtual HQ di-deploy. Uji online: `POST /agent` dijawab "diterima" dalam 4 dtk (termasuk sesi baru) dan 5 dtk kemudian API mencatat `bedrock-agentcore` mengambil antrian; `GET /agent-runs/worker` membawa `agentcore: true`. Run penuh online dengan worker laptop dimatikan (toko 74, jalur yang sama dengan tombol dashboard): runtime menjawab dalam 6 dtk, tugas diambil `bedrock-agentcore` pada detik ke-7, agent SELESAI dengan Claude Sonnet 4.6 (8 tool, 18,8 dtk; total 27 dtk dari klik): hold Ciroc, Capt Morgan tidak di-hold karena komplementer, 2 draf PO (Bacardi Gold Rum, Smirnoff 80 Proof), realokasi. Uji langkah 8 di skrip sempat terlewat karena PowerShell 5.1 membaca JSON `null` dari `/agent-runs/aktif` sebagai teks "null"; sudah diperbaiki. `docs/Komponen_Teknologi_Rexa.pdf` diperbarui ke kondisi ini (diagram baru: AgentCore, Bedrock, Copilot, Virtual HQ; laptop opsional), dengan sumber HTML-nya kini ikut di `docs/`. |
| 26 Okt 2026 | **Doni (Crisis Hub) kini benar-benar pengawas proaktif**, sesuai dokumen arsitektur Doni dari tim. Masalah di situs online: Doni baru memeriksa data setelah 30 menit (selama demo praktis tidak pernah alarm), panel menulis URGENT tetapi tombol Doni Hub dan sprite Doni tetap normal, dan angka SKU kritis Doni (5) bisa berbeda dengan laporan Maya (6) karena dibaca terpisah. Perbaikan: `pantauKrisis()` di `StoreCrisisState.js` dipanggil App saat dibuka, saat toko/mode/tanggal berganti, setiap data berubah (agent selesai, PO diputuskan, breaker direset), dan tiap menit selama tab terlihat; hasilnya satu sumber untuk tombol header, sprite Doni, dan panel (event `doni-status`). SKU kritis Doni dibaca dari endpoint yang sama dengan Maya (`/stores/{s}/maya/status`). Krisis berstatus BARU (tombol merah, Doni mendatangi pemain, klaxon sekali per krisis) atau DITANGANI (tombol kuning "⏳ KRISIS DITANGANI"): setelah agent ditugaskan dari panel, saat agent sedang bekerja untuk toko itu (dari mana pun dijalankan), atau saat semua SKU kritis sudah punya draf PO yang tinggal disetujui. Panel menampilkan semua temuan lintas divisi (bisa dipilih) dan tabel SKU kritis (stok/ROP, saran PO, status draf); tugas agent membawa daftar SKU yang belum punya draf; tombol Meja Approval muncul untuk draf yang menunggu. Diuji ujung ke ujung di Edge headless dengan API lokal dan agent Claude sungguhan: alarm langsung saat dibuka (7 SKU, sama dengan Maya), Citra ditinjau, agent ditugaskan → DITANGANI, agent selesai 21 dtk dengan 2 draf → "2 sudah punya draf PO menunggu persetujuan" dan Meja Approval (2), draf disetujui → SKU itu keluar dari daftar; mode Semua Toko (4 toko merah) dan HP 390 px. |
| 26 Okt 2026 | Doni sekarang **menyelesaikan** krisis, bukan hanya menyuruh agent menyusun draf (masukan tim). Tombol **🛠️ Selesaikan** (klik manajer = persetujuannya, tertulis di bawah tombol): krisis stok → Rexa memesan semua SKU kritis, lalu PO yang lolos guardrail langsung disetujui dan dikirim ke SAP sehingga barangnya dalam pengiriman; Health di zona merah → Rexa menangani toko lalu PO-nya dikirim ke SAP; modal tertahan → Rexa menahan reorder SKU yang turun dan mengalihkan modal; breaker → reset. Kemajuan (Rexa bekerja → kirim ke SAP → hasil) dan hasilnya (nomor PO SAP, PO yang ditahan guardrail, modal diselamatkan) tampil di panel; guardrail tetap berlaku. Supaya Rexa bisa memesan lebih dari 2 SKU, tool `list_prioritas` agent kini menerima `limit_naik` (1-10, default tetap 2) dan prompt menambah aturan: kalau tugas menyebut daftar SKU, kerjakan hanya SKU itu. 113 test lulus (1 baru). Diuji ujung ke ujung (API lokal, agent Claude sungguhan): krisis 7 SKU → Rexa memesan ketujuhnya → 6 PO terkirim ke SAP (4500000001-6) dalam 20 dtk, 1 ditahan guardrail batas harian Rp100 juta dan dilaporkan; krisis Citra → reorder 1 SKU ditahan, modal diselamatkan Rp 28,6 juta. Ter-deploy (agent AgentCore dan dashboard) hari yang sama. Perbaikan susulan dari uji online: kalau dua krisis diselesaikan berurutan (Maya lalu Citra), yang kedua sempat "menumpang" ke run yang pertama karena Rexa hanya mengerjakan satu tugas sekaligus. Penyelesaian kini bergiliran (panel menulis "Menunggu giliran Rexa"), hanya mengikuti run dengan tugasnya sendiri, mengirim ulang permintaan kalau App belum siap, dan "tidak ada tindakan baru" dilaporkan sebagai hasil, bukan kegagalan. Diuji: Maya selesai 15 dtk (5 PO ke SAP), Citra menunggu lalu selesai 32 dtk dengan run-nya sendiri. |
| 26 Okt 2026 | Perbaikan dari uji online "Selesaikan tapi tidak selesai": menekan "Selesaikan sisa" berulang membuat Jack Daniels (Rp 40,3 juta) terus dipesan ulang padahal anggaran PO harian Toko 74 tinggal Rp 4,5 juta, sehingga ditahan **BATAS_HARIAN** tiga kali dan **circuit breaker terbuka**; panel juga menulis "✅ DISELESAIKAN" padahal tidak ada PO terkirim. Akar masalahnya: batas harian dihitung per tanggal kalender, bukan per hari simulasi, sehingga memajukan tanggal tidak membuka anggaran. Perbaikan: (1) API: `guardrails.total_po_hari_ini` memakai `purchase_orders.hari_dibuat` (hari simulasi), juga di `GET /guardrails/status`; (2) Doni membaca sisa anggaran dan hanya memesan SKU yang muat (dari risiko tertinggi), sisanya berstatus "anggaran hari berikutnya" dengan catatan anggaran dan tombol nonaktif, sehingga tidak ada PO yang dipesan hanya untuk ditahan; (3) selama breaker terbuka, krisis yang butuh PO diarahkan ke "Reset circuit breaker dulu (temuan Rian)"; (4) hasil yang hanya berisi PO ditahan ditulis BELUM SELESAI. 113 test lulus (test batas harian ditambah maju/mundur hari simulasi). Diuji ujung ke ujung: hari 1 Doni memesan 5 SKU yang muat (Rp 99,9 juta, 5 PO ke SAP, 0 ditahan), 2 SKU menunggu; +1 hari → 4 SKU berikutnya ke SAP; breaker tetap tertutup. Perlu deploy ulang API dan dashboard. |
| 17 Okt 2026 | AWS CLI 2.38.1 terpasang dan `aws login` berhasil (ditambah `awscrt` di requirements). Tes Bedrock belum lulus karena **akun AWS masih dalam verifikasi** ("Your account is currently being verified"); ini juga penyebab halaman "Complete your account setup" di konsol Bedrock. Menunggu verifikasi lalu tes ulang. |
