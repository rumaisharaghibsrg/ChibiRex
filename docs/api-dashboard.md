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

Per 24 Okt 2026 **semua** bagian dashboard memakai data API; tidak ada lagi data contoh (`src/data/` sudah dihapus). Diuji di browser terhadap API lokal.

- **`src/lib/api.js`**: klien untuk semua endpoint di dokumen ini (`api.ringkasan(store)`, `api.daftarSku(...)`, `api.holds(store)`, dan seterusnya). Pakai klien ini untuk semua panggilan API; jangan memakai `fetch` langsung. Galat dilempar sebagai `ApiError` dengan `message` yang siap ditampilkan. Format angka, Rupiah, dan tanggal ada di `src/lib/format.js`.
- **`src/lib/useDataToko.js`**: memuat semua data satu toko (ringkasan, SKU REORDER, PO, hold, realokasi, status guardrail, hitung fisik) sekali di `DashboardApp`, lalu dibagikan ke kartu lewat props. Baris tabel Smart Reorder sudah digabung dengan PO dan Hold lewat `inventory_id`. Dimuat ulang setiap toko atau `refreshKey` berubah; setelah ada aksi yang mengubah data, panggil `muatUlang()`.
- **`src/lib/skenario.js`**: skenario Runaway PO dan selisih stok untuk menu "Skenario Uji" di `Header`.
- **`src/lib/copilot.js`**: jawaban Copilot dari data API (belum memakai LLM).
- **`AgentRunPanel`**, **`PendingPoCard`**, **`PoApprovalModal`**: panel agent, draf PO, dan 1-Click Approval (sejak 20 Okt).
- **`Header`** (pilihan toko, level otonomi, Skenario Uji, status API), **`Sidebar`** (badge dari ringkasan dan status breaker), **`TopKeyMetricsRow`**, **`KpiGrid`**, **`ExplorationBudgetCard`**, **`CapitalReallocationCard`**, **`SmartReorderTable`**, **`SuppressionDetailModal`**, **`GuardrailsModal`**, **`AiCopilotWidget`**.

`HealthScoreCard`, `FormulaModal`, `ScenarioBar`, `AgenticPipelineVisualizer`, dan `OnboardingBanner` tidak dipakai di dashboard sekarang.

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
| `TopKeyMetricsRow` (kartu Inventory Health + rincian) | `GET /stores/{store}/ringkasan` | `health_score`, `komponen[]` (`nama`, `nilai`, `penjelasan`), `rumus`, `per_tanggal` |
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

1. `POST /agent-runs/mulai` dengan body `{"store": 74}`. Responsnya `202` dan berisi `run_id` dengan `status: "BERJALAN"` (mode lokal) atau `"MENUNGGU"` (mode antrian, sampai worker mengambilnya). Kalau agent masih berjalan, responsnya `409 AGENT_SEDANG_BERJALAN` dengan `detail.run_id` milik run yang sedang berjalan; panel langsung memantau run itu.
   Saat panel dibuka atau halaman di-refresh, `GET /agent-runs/aktif` mengembalikan run yang sedang MENUNGGU/BERJALAN (atau `null`). Daftar `GET /agent-runs` membawa `status` dan `pesan` (penyebab kalau GAGAL).
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

## Jam simulasi (kontrol tanggal di `Header`)

Data Bibitor berhenti di 31 Des 2016, jadi waktu dimajukan dari tanggal itu (`api/simulasi.py`). Setiap hari simulasi, stok setiap SKU berkurang sesuai permintaan harian dari data (acak tetapi sama untuk SKU dan hari yang sama), dan barang dari PO yang disetujui serta stok uji Hold Reorder tiba setelah lead time vendor. Status stok, prediksi habis, saran PO, Health Score, realokasi, dan prioritas agent ikut berubah.

- `GET /simulasi` → `hari_ke`, `tanggal`, `otomatis`, `detik_per_hari`, `hari_maks` (90 hari).
- `POST /simulasi/maju` body `{"hari": 1-30, "oleh": "..."}`: tombol "+1 hari" dan "+7 hari".
- `POST /simulasi/otomatis` body `{"aktif": true, "detik_per_hari": 10|30|60}`: satu hari simulasi tiap N detik nyata; `{"aktif": false}` untuk jeda. Tidak ada proses latar: hari dihitung dari waktu nyata sejak terakhir diatur.
- Dashboard memeriksa `GET /simulasi` berkala (tiap ≤5 detik saat otomatis, 15 detik saat jeda) dan memuat ulang data setiap hari berganti.
- Field baru: SKU `stok_dalam_pengiriman` (barang PO disetujui yang belum tiba; reorder memakai stok gudang + dalam pengiriman, jadi SKU yang sedang dikirim tidak dipesan ulang), PO `tgl_tiba`. `ringkasan.per_tanggal` = tanggal simulasi.
- `GET /stores` tetap memakai data 31 Des 2016 (mensimulasikan 80 toko sekaligus terlalu berat).
- `POST /demo/reset` (`python -m agent.reset_demo`) mengembalikan jam ke 31 Des 2016.

## Skenario selisih stok (menu "Skenario Uji" di `Header`)

Mendemokan mitigasi inakurasi data: hasil hitung fisik (simulasi) yang berbeda dari stok sistem menurunkan Data Confidence, dan guardrail menahan PO sampai selisihnya diaudit.

1. Ambil SKU target, misalnya SKU teratas dari `GET /stores/{store}/prioritas?limit_naik=1&limit_turun=0` (toko 74: Bacardi Gold Rum).
2. `POST /sku/{inventory_id}/stok-fisik` dengan body `{"stok_fisik": round(stok_akhir × 0,75), "dicatat_oleh": "<nama manajer>", "catatan": "Simulasi stock opname"}`. Respons berisi `data_confidence_data` (sebelum), `data_confidence` (sesudah, misalnya 1,00 → 0,74), dan `perlu_audit`.
3. Jalankan agent. Draf PO SKU itu akan berstatus `DITAHAN_GUARDRAIL` dengan kode `DATA_CONFIDENCE_RENDAH`; draf lama SKU itu juga ditolak saat approve (409).
4. Tampilkan daftar yang menunggu audit dari `GET /stores/{store}/stok-fisik`, dengan tombol "Audit selesai" yang memanggil `DELETE /sku/{inventory_id}/stok-fisik?oleh=<nama manajer>` (204).

Versi terminalnya: `python -m agent.skenario_selisih_stok --store 74`, lalu `--audit-selesai` di akhir demo.

## Skenario uji Runaway PO (menu "Skenario Uji" di `Header`)

Belum ada endpoint khusus. Skenario ini cukup berupa urutan panggilan API yang sama dengan `agent/skenario_runaway.py`:

1. `GET /stores/{store}/prioritas?limit_naik=10&limit_turun=0`, lalu ambil SKU dari `naik`.
2. Untuk 3 SKU: `POST /purchase-orders` dengan `qty = ceil(saran_qty_po × 18,5)` dan `dibuat_oleh: "skenario uji Runaway PO"`. Angka 18,5 adalah median lonjakan pesanan borongan di data Online Retail II. Hasilnya `DITAHAN_GUARDRAIL` (`OUTLIER_3SIGMA`).
3. `GET /guardrails/status`: circuit breaker kini terbuka.
4. Satu PO normal (tanpa `qty`) juga ditahan dengan kode `CIRCUIT_BREAKER`.
5. Manajer menekan "Reset" (`POST /guardrails/circuit-breaker/reset`). Jangan reset otomatis, karena langkah ini adalah human-in-the-loop yang ingin ditunjukkan.

## Aturan untuk perubahan berikutnya

- Jangan menambah data tiruan atau KPI tanpa sumber. Angka yang belum ada di API dicatat sebagai kebutuhan endpoint baru.
- Klaim arsitektur yang benar: Strands Agents + LLM (Ollama `qwen3:14b` di laptop lewat worker), FastAPI di Lambda, dan tiruan SAP S/4HANA (OData `API_PURCHASEORDER_PROCESS_SRV`). Bukan SageMaker, bukan SAP BTP, dan Bedrock tidak dipakai (kuota 0). `LandingPage` masih perlu dicek untuk klaim seperti ini.
- Chatbot Copilot belum memakai LLM; labelnya harus tetap jujur sampai ada endpoint LLM read-only.
- Realokasi tidak punya aksi sendiri di backend: dana dipakai saat PO tujuan disetujui, jadi tombolnya membuka draf PO tujuan.

## Sumber data per modul (untuk label di dashboard)

| Modul | Dataset |
|---|---|
| Stok, Vs, lead time, ROP, saran PO, Health Score | Bibitor (Kaggle, data edukasi HUB of Analytics) |
| Cek substitusi / peran komplementer | Instacart Market Basket |
| Skor risiko stok habis | Model LightGBM pra-latih dari Product Backorders (indikatif) |
| Uji Runaway PO (rasio 18,5×) | Online Retail II UCI |

## Memakai dokumen ini di Kiro

Simpan rujukan ke dokumen ini di steering Kiro, misalnya file `.kiro/steering/api-dashboard.md` yang berisi `#[[file:docs/api-dashboard.md]]`, atau lampirkan dengan `#File` di chat Kiro. Dengan begitu spec dan kode yang dibuat Kiro mengikuti kontrak ini. Kalau butuh endpoint atau field baru, catat di spec lalu minta ke backend; jangan membuat data tiruan di front-end.
