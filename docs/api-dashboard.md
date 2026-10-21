# Kontrak API untuk Dashboard Rexa

Panduan menyambungkan dashboard React (`dashboard/`) ke API backend (`api/`). Semua angka, status, dan aksi di dashboard harus berasal dari API ini, bukan dari `src/data/mockData.js`, supaya demo final memperlihatkan agent yang benar-benar bekerja.

Dokumentasi interaktif semua endpoint (bisa dicoba langsung): http://127.0.0.1:8000/docs

## Menjalankan untuk pengembangan

Terminal 1, dari root repo (butuh `.venv` dan `python -m engine.pipeline` yang sudah pernah dijalankan):

```powershell
uvicorn api.main:app
```

Terminal 2:

```powershell
cd dashboard
npm install
npm run dev
```

- Simpan alamat API di `dashboard/.env.local` (tidak ikut di-commit): `VITE_API_URL=http://127.0.0.1:8000`, lalu baca dengan `import.meta.env.VITE_API_URL`.
- CORS sudah mengizinkan `http://localhost:5173` dan `http://127.0.0.1:5173`. Origin lain ditambahkan lewat env `CHIBIREX_CORS_ORIGINS` di backend.
- Tombol "Jalankan agent" butuh Ollama yang sedang berjalan (`qwen3:14b`) dan API di port 8000.

## Yang sudah tersambung (jangan dikerjakan ulang)

Inti demo sudah tersambung ke API dan sudah diuji di browser dengan agent asli (20 Okt 2026):

- **`src/lib/api.js`**: klien untuk semua endpoint di dokumen ini (`api.ringkasan(store)`, `api.daftarSku(...)`, `api.holds(store)`, dan seterusnya). Pakai klien ini untuk semua panggilan API; jangan memakai `fetch` langsung. Galat dilempar sebagai `ApiError` dengan `message` yang siap ditampilkan. Format Rupiah ada di `src/lib/format.js`.
- **`AgentRunPanel`**: tombol "Jalankan Agent", empat fase Plan/Reason/Act/Review, langkah agent muncul selagi berjalan, ringkasan akhir, dan run terakhir dimuat ulang setelah refresh.
- **`PendingPoCard`**: draf PO yang menunggu persetujuan dan PO yang sudah masuk SAP.
- **`PoApprovalModal`**: menerima `poId`, menampilkan PO asli, alasan agent, hasil guardrail, dan payload SAP, lalu approve/reject lewat API. Nomor PO SAP diambil dari respons.
- **Footer** `DashboardApp`: klaim arsitektur sudah disesuaikan.

Saat menyambungkan `SmartReorderTable`, buka approval dengan `setSelectedPoId(po.po_id)` (sekarang `onSelectPo` masih menampilkan toast "data contoh"). Toko demo diatur oleh konstanta `DEMO_STORE` di `DashboardApp.jsx`, sampai pilihan cabang di `Header` tersambung ke `GET /stores`. Setelah ada aksi yang mengubah data, panggil `muatUlang()` supaya kartu lain ikut memuat ulang (lewat `refreshKey`).

## Aturan umum

- **Data simulasi.** Data berasal dari Bibitor (studi kasus jaringan 80 toko minuman) per **31 Des 2016**, dengan nilai dalam Rupiah dari kurs tetap Rp16.000/USD. Tampilkan label "Data simulasi" dan keterangan sumber data (tabel di bawah). Produknya minuman (rum, vodka, wine), bukan kopi.
- **Toko default demo: 74** (PAENTMARWY). SKU demo: Bacardi Gold Rum (draf PO) dan Ciroc Apple Vodka (Hold Reorder).
- **Format galat:** galat bisnis berbentuk `{"detail": {"kode": "...", "pesan": "..."}}`. Tampilkan `pesan` ke pengguna. Galat validasi FastAPI (422) berbentuk `{"detail": [...]}`.
- **Idempotency-Key** wajib untuk `POST /purchase-orders` dan `POST /holds` (pakai `crypto.randomUUID()`). Approve, reject, dan reset tidak membutuhkannya.
- **Persetujuan selalu oleh manusia.** Kirim body `{"oleh": "<nama manajer>", "catatan": "..."}` untuk approve, reject, dan reset circuit breaker.
- **Level 3 (PO otomatis) belum aktif.** Di proposal, Level 3 baru masuk Fase 3. Tampilkan sebagai "segera hadir" atau sembunyikan; jangan ada PO berstatus "Auto".

## Peta komponen ke endpoint

| Komponen | Endpoint | Field yang dipakai |
|---|---|---|
| `Header`: pilihan cabang | `GET /stores` | `store`, `kota`, `sku_aktif`, `perlu_reorder` |
| `HealthScoreCard` + `FormulaModal` | `GET /stores/{store}/ringkasan` | `health_score`, `komponen[]` (`nama`, `nilai`, `penjelasan`), `rumus`, `per_tanggal` |
| `KpiGrid` | `GET /stores/{store}/ringkasan` | `modal_diselamatkan_idr`, `po_menunggu`, `nilai_po_menunggu_idr`, `sku_risiko_tinggi`, `modal_tertahan_idr`, `nilai_stok_idr` |
| `ExplorationBudgetCard` | `GET /stores/{store}/ringkasan`, `GET /holds?store=` | `exploration_budget_idr`; per hold: `qty_uji`, `nilai_uji_idr`, `review_pada` |
| `CapitalReallocationCard` | `GET /stores/{store}/reallocation` | `dana_tersedia_idr`, `sumber[]`, `tujuan[]` (`deskripsi`, `dialokasikan_idr`), `sisa_dana_idr`, `pesan` |
| `SmartReorderTable` | `GET /sku?store=&status_stok=REORDER&limit=50`, `GET /purchase-orders?store=`, `GET /holds?store=` | lihat tabel field SKU di bawah; gabungkan status PO/hold lewat `inventory_id` |
| `PoApprovalModal` | `GET /purchase-orders/{po_id}`, `GET /purchase-orders/{po_id}/sap-payload`, `POST /purchase-orders/{po_id}/approve` atau `/reject` | `qty`, `nilai_idr`, `alasan` (penalaran agent), `pelanggaran[]`, `vendor_name`; setelah approve: `sap_po_number` |
| `SuppressionDetailModal` | `GET /holds?store=`, `GET /sku/{id}/substitution` | `modal_diselamatkan_idr`, `alasan`, `qty_uji`; substitusi: `status`, `mitra[]` (`jenis`, `lift_alk`) |
| `GuardrailsModal` | `GET /guardrails/status?store=`, `POST /guardrails/circuit-breaker/reset`, `GET /audit-log` | `circuit_breaker_terbuka`, `alasan`, `batas_po_harian_idr`, `total_po_hari_ini_idr`, `outlier_sigma`, `data_confidence_min` |
| Panel agent (baru) | `POST /agent-runs/mulai`, `GET /agent-runs/{run_id}`, `GET /agent-runs` | lihat bagian "Menjalankan agent" |

### Field SKU (`GET /sku`, `GET /sku/{inventory_id}`)

| Di desain | Field API | Catatan |
|---|---|---|
| Nama produk, SKU, kategori | `deskripsi`, `inventory_id`, `jenis` / `kategori` | `jenis` misalnya RUM, VODKA |
| Stok, batas ROP | `stok_akhir`, `reorder_point`, `perlu_reorder` | |
| Skor kecepatan jual | `vs_tahun`, `tren_beli`, `arah_tren` | `arah_tren`: NAIK, TURUN, STABIL, TIDAK_ANDAL |
| Prediksi habis | `tgl_perkiraan_habis`, `hari_cukup` | tanggal simulasi (2017) |
| Keyakinan AI | `skor_risiko` (0-100), `level_risiko` | Confidence Score risiko stok habis: TINGGI ≥ 90, SEDANG ≥ 70. Ini peringkat, bukan persen; tulis "Skor risiko 96 (TINGGI)" |
| Data Confidence | `data_confidence` | 0-1; di bawah 0,8 PO ditahan guardrail |
| Saran PO | `saran_qty_po`, `nilai_saran_po_idr`, `vendor_name`, `lead_time_rata` | |

Status di kolom aksi:
- PO berstatus `DRAFT` → tombol "1-Click Approval".
- PO berstatus `DITAHAN_GUARDRAIL` → tampilkan `pelanggaran[].pesan`.
- Hold `AKTIF` → "Hold Reorder • cek alasan".
- Selain itu → belum ditindak agent.

## Menjalankan agent (sudah dipakai `AgentRunPanel`)

Juri meminta loop agent terlihat jelas: **plan → reason → act → review**, dengan persetujuan manusia.

1. `POST /agent-runs/mulai` dengan body `{"store": 74}`. Responsnya `202` dan berisi `run_id` dengan `status: "BERJALAN"`. Kalau agent masih berjalan, responsnya `409 AGENT_SEDANG_BERJALAN`.
2. Panggil `GET /agent-runs/{run_id}` setiap 1-2 detik. `langkah[]` bertambah setiap kali agent memanggil tool. Setiap langkah berisi `tool`, `input` (termasuk `alasan` dari agent), `output`, dan `detik`.
3. Saat `status` menjadi `SELESAI`, tampilkan `jawaban` (ringkasan agent), lalu muat ulang ringkasan, tabel, dan daftar PO. Kalau `GAGAL`, tampilkan `pesan`.

Saran pengelompokan langkah untuk tampilan:

| Fase | Tool |
|---|---|
| PLAN | `list_prioritas` |
| REASON | `get_sku_metrics`, `check_substitution` |
| ACT | `hold_reorder`, `draft_purchase_order`, `suggest_reallocation` |
| REVIEW | `output.pelanggaran` atau `output.ditolak` (guardrail menahan aksi), `jawaban` akhir, lalu PO menunggu approval manajer |

Dengan LLM lokal, satu kali jalan butuh ±30-60 detik, jadi tampilkan langkah satu per satu selagi berjalan.

## Skenario selisih stok (tombol di `ScenarioBar`)

Mendemokan mitigasi inakurasi data: hasil hitung fisik (simulasi) yang berbeda dari stok sistem menurunkan Data Confidence, dan guardrail menahan PO sampai selisihnya diaudit.

1. Ambil SKU target, misalnya SKU teratas dari `GET /stores/{store}/prioritas?limit_naik=1&limit_turun=0` (toko 74: Bacardi Gold Rum).
2. `POST /sku/{inventory_id}/stok-fisik` dengan body `{"stok_fisik": round(stok_akhir × 0,75), "dicatat_oleh": "<nama manajer>", "catatan": "Simulasi stock opname"}`. Respons berisi `data_confidence_data` (sebelum), `data_confidence` (sesudah, misalnya 1,00 → 0,74), dan `perlu_audit`.
3. Jalankan agent. Draf PO SKU itu akan berstatus `DITAHAN_GUARDRAIL` dengan kode `DATA_CONFIDENCE_RENDAH`; draf lama SKU itu juga ditolak saat approve (409).
4. Tampilkan daftar yang menunggu audit dari `GET /stores/{store}/stok-fisik`, dengan tombol "Audit selesai" yang memanggil `DELETE /sku/{inventory_id}/stok-fisik?oleh=<nama manajer>` (204).

Versi terminalnya: `python -m agent.skenario_selisih_stok --store 74`, lalu `--audit-selesai` di akhir demo.

## Skenario uji Runaway PO (tombol di `ScenarioBar`)

Belum ada endpoint khusus. Skenario ini cukup berupa urutan panggilan API yang sama dengan `agent/skenario_runaway.py`:

1. `GET /stores/{store}/prioritas?limit_naik=10&limit_turun=0`, lalu ambil SKU dari `naik`.
2. Untuk 3 SKU: `POST /purchase-orders` dengan `qty = ceil(saran_qty_po × 18,5)` dan `dibuat_oleh: "skenario uji Runaway PO"`. Angka 18,5 adalah median lonjakan pesanan borongan di data Online Retail II. Hasilnya `DITAHAN_GUARDRAIL` (`OUTLIER_3SIGMA`).
3. `GET /guardrails/status`: circuit breaker kini terbuka.
4. Satu PO normal (tanpa `qty`) juga ditahan dengan kode `CIRCUIT_BREAKER`.
5. Manajer menekan "Reset" (`POST /guardrails/circuit-breaker/reset`). Jangan reset otomatis, karena langkah ini adalah human-in-the-loop yang ingin ditunjukkan.

## Yang perlu diubah dari desain sekarang

- Ganti semua data di `mockData.js` dan `copilotKnowledge.js` dengan data API.
- **KPI tanpa sumber data** (stockout 2,1% vs 11,4%, akurasi ML 91,8%, proses PO 2,3 menit, "Termasuk PPN", "Sinkronisasi Real-Time"): ganti dengan angka dari API, atau beri label "Target proposal" kalau tetap ingin ditampilkan.
- **Sesuaikan klaim arsitektur** di komponen lain (`AgenticPipelineVisualizer`, `GuardrailsModal`, `Sidebar`, `LandingPage`): kita tidak memakai SageMaker. Yang dipakai: Strands Agents + LLM (Ollama lokal sekarang, Amazon Bedrock di final), FastAPI, dan tiruan SAP S/4HANA (OData `API_PURCHASEORDER_PROCESS_SRV`), bukan SAP BTP.
- **Chatbot Copilot** belum punya endpoint LLM. Sementara ini, ubah jadi tombol pertanyaan cepat yang menjawab dari data API (misalnya "modal diselamatkan" dari ringkasan), atau tandai "segera hadir".
- Tombol "Terapkan realokasi" tidak punya aksi di backend. Realokasi terjadi lewat persetujuan PO tujuan, jadi arahkan tombolnya ke PO terkait.

## Sumber data per modul (untuk label di dashboard)

| Modul | Dataset |
|---|---|
| Stok, Vs, lead time, ROP, saran PO, Health Score | Bibitor (Kaggle, data edukasi HUB of Analytics) |
| Cek substitusi / peran komplementer | Instacart Market Basket |
| Skor risiko stok habis | Model LightGBM pra-latih dari Product Backorders (indikatif) |
| Uji Runaway PO (rasio 18,5×) | Online Retail II UCI |

## Memakai dokumen ini di Kiro

Simpan rujukan ke dokumen ini di steering Kiro, misalnya file `.kiro/steering/api-dashboard.md` yang berisi `#[[file:docs/api-dashboard.md]]`, atau lampirkan dengan `#File` di chat Kiro. Dengan begitu spec dan kode yang dibuat Kiro mengikuti kontrak ini. Kalau butuh endpoint atau field baru, catat di spec lalu minta ke backend; jangan membuat data tiruan di front-end.
