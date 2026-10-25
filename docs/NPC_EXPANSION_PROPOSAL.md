# 📘 Virtual HQ — Proposal Ekspansi NPC Berbasis Fitur (Tugas C)
**Status Dokumen:** Approved for Implementation  
**Konteks Proyek:** ChibiRex Virtual HQ (Phaser 3 + React + FastAPI)  
**Tujuan:** Mengintegrasikan seluruh kapabilitas bisnis backend REST API ChibiRex ke dalam identitas NPC (Functional AI Agents) interaktif di ruang kantor virtual 2.5D.

---

## 1. Ringkasan Eksekutif

Kantor virtual tidak boleh sekadar menjadi display kosmetik dengan NPC yang hanya berdiri diam tanpa fungsi (*decorative NPCs*). Setiap agen yang ditempatkan di dalam ruang kerja **harus mewakili kapabilitas bisnis nyata** dari backend API ChibiRex:
1. **Rexa (Copilot AI)**: Autonomous Inventory Reorder Reasoning (Bedrock/Local LLM).
2. **Manajer Toko (Approval Desk)**: 1-Click PO Release ke SAP S/4HANA OData V2.
3. **Maya (Auditor Stok & Gudang)**: Stock Opname Fisik & Pemulihan Data Confidence.
4. **Citra (Financial Strategist)**: Realokasi Modal Kas Toko & Hold Reorder Management.
5. **Rian (Security & Compliance Sentinel)**: Guardrail Circuit Breaker, Anti-Runaway, & Demo Reset.
6. **Pak Budi (Store Operations Director)**: Store Health Score (Ketersediaan, Perputaran, Stabilitas Kas) & Multi-Store KPI.

---

## 2. Audit Kapabilitas Backend & REST API ChibiRex

Berdasarkan analisis menyeluruh pada modul `api/main.py`, `agent/tools.py`, `agent/run.py`, dan `engine/`:

| Modul / Domain | Endpoint API Utama | Method | Peran & Logika Bisnis |
| :--- | :--- | :---: | :--- |
| **Agent Core** | `/agent-runs/mulai`<br>`/agent-runs/{run_id}` | `POST`<br>`GET` | Menjalankan siklus penalaran AI mandiri (Bedrock/Ollama), mengeksekusi tools prioritas, metrik, substitusi, hold, dan draf PO. |
| **SAP S/4HANA PO** | `/purchase-orders`<br>`/purchase-orders/{id}/approve`<br>`/purchase-orders/{id}/reject`<br>`/purchase-orders/{id}/sap-payload` | `GET`<br>`POST`<br>`POST`<br>`GET` | 1-Click Approval manajer: menerbitkan Purchase Order resmi ke SAP S/4HANA (`API_PURCHASEORDER_PROCESS_SRV`) dan menyimpan nomor PO SAP. |
| **Stock Opname & Audit** | `/sku/{id}/stok-fisik`<br>`/stores/{store}/stok-fisik`<br>`/sku/{id}/stok-fisik` | `POST`<br>`GET`<br>`DELETE` | Mencatat hasil hitung fisik gudang. Selisih fisik vs sistem menurunkan *Data Confidence Score*. Jika di bawah ambang (< 0.85), guardrail mengunci release PO SAP sampai selisihnya diaudit (`DELETE`). |
| **Cash Optimization** | `/stores/{store}/reallocation`<br>`/holds` | `GET`<br>`GET` | Mengalihkan dana dari SKU *slow-moving* yang di-*Hold* ke SKU bertren penjualan naik di toko yang sama, serta mengelola alokasi belanja uji pasar (*10% exploration budget*). |
| **Guardrail & Safety** | `/guardrails/status`<br>`/guardrails/circuit-breaker/reset`<br>`/demo/reset` | `GET`<br>`POST`<br>`POST` | Memantau *Circuit Breaker* (mencegah *runaway agent* jika terjadi lonjakan pemesanan anomali), membatasi batas nominal PO harian (Rp 50 Juta), dan mereset demo state. |
| **Executive Intelligence** | `/stores/{store}/ringkasan`<br>`/stores`<br>`/audit-log` | `GET`<br>`GET`<br>`GET` | Menghitung 3 pilar *Inventory Health Score* (Ketersediaan %, Perputaran %, Stabilitas Kas %), estimasi valuasi aset stok, risiko stockout, dan komparasi toko cabang. |

---

## 3. Matriks Lengkap Mapping NPC (Functional Roles)

Seluruh 6 karakter di dalam kantor memiliki tanggung jawab peran, endpoint API tujuan, alur interaksi UI, dan lokasi koordinat yang presisi:

| No | Nama & Gelar NPC | Fitur & API yang Diwakili | Aksi Interaksi UI saat Tekan `[E]` | Lokasi Meja / Area di Map (Grid 24×16) | Frame Spritesheet (`32x32folk.png`) |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Rexa**<br>*(AI Inventory Copilot)* | `/agent-runs/mulai`<br>`/agent-runs/{id}` | **Thought Bubble Terminal:**<br>Memicu patroli AI mandiri Toko 74, inspeksi live tool-calling argument, dan hasil evaluasi draf PO / hold. | **Ruang Copilot (Kiri Atas)**<br>Meja: row 3, col 3–4<br>Posisi: `x: 128, y: 84` | **Char 1** (Row 0–3, Cols 3–5)<br>Idle-Down: `4`<br>*(Wanita berkemeja hijau/teal)* |
| **2** | **Manajer Toko**<br>*(PO Approval Desk)* | `/purchase-orders`<br>`/purchase-orders/{id}/approve`<br>`/purchase-orders/{id}/sap-payload` | **Modal 1-Click SAP Approval:**<br>Review draf PO, cek kepatuhan guardrail, inspeksi payload OData V2 SAP S/4HANA, tombol approve dengan selebrasi *confetti*, atau tolak PO. | **Ruang Manajer (Kanan Atas)**<br>Meja: row 3, col 19–20<br>Posisi: `x: 640, y: 84` | **Char 2** (Row 0–3, Cols 6–8)<br>Idle-Down: `7`<br>*(Pria/Wanita berpakaian jas formal)* |
| **3** | **Maya**<br>*(Auditor Stok & Gudang)* | `/stores/{store}/stok-fisik`<br>`/sku/{id}/stok-fisik` | **Modal Stock Opname & Audit Fisik:**<br>Daftar SKU yang mengalami selisih fisik vs sistem, form input opname fisik, indikator Data Confidence, dan tombol 1-Click *"Selesaikan Audit"* untuk membuka kunci PO SAP. | **Area Hot-Desk & Arsip (Bawah Kanan)**<br>Meja: row 12, col 18–20<br>Posisi: `x: 608, y: 368` | **Char 5** (Row 4–7, Cols 3–5)<br>Idle-Down: `52`<br>*(Wanita berbusana pink/terracotta)* |
| **4** | **Citra**<br>*(Financial Strategist)* | `/stores/{store}/reallocation`<br>`/holds` | **Modal Realokasi Modal Kas Toko:**<br>Menampilkan total kas yang diselamatkan dari *Hold Reorder*, daftar alokasi dana ke SKU fast-moving, rincian exploration budget 10%, dan sisa kas toko. | **Meja Meeting Utama (War Room)**<br>Meja: row 3–4, col 10–13<br>Posisi: `x: 320, y: 112` (Kursi Rapat) | **Char 4** (Row 4–7, Cols 0–2)<br>Idle-Down: `49`<br>*(Wanita pirang berkemeja gelap)* |
| **5** | **Rian**<br>*(Security & Guardrail Admin)* | `/guardrails/status`<br>`/guardrails/circuit-breaker/reset`<br>`/demo/reset` | **Modal Security & Guardrail Command:**<br>Status *Circuit Breaker* (Normal/Tripped), meteran batas nominal PO harian (Rp 50 Juta), tombol darurat *Reset Breaker*, dan tombol *Reset Demo State*. | **Tech Hub / Server Rack (Kiri Atas)**<br>Area: row 2, col 6<br>Posisi: `x: 192, y: 84` | **Char 6** (Row 4–7, Cols 6–8)<br>Idle-Down: `55`<br>*(Pria teknisi berjaket abu-abu)* |
| **6** | **Pak Budi**<br>*(Store Operations Director)* | `/stores/{store}/ringkasan`<br>`/stores` | **Modal Executive Store Intelligence:**<br>Menampilkan 3 gauge *Inventory Health Score* (Ketersediaan, Perputaran, Stabilitas Kas), total aset stok toko (Rp), SKU kritis, dan *switcher* toko cabang. | **Smart Screen Area (Tengah Atas)**<br>Area: row 2, col 12<br>Posisi: `x: 384, y: 84` | **Char 3** (Row 0–3, Cols 9–11)<br>Idle-Down: `10`<br>*(Pria eksekutif berambut putih)* |

---

## 4. Formula Matematis Frame Spritesheet (Anti-Bleeding Matrix)

Aset `32x32folk.png` memiliki dimensi $384 \times 256\text{ px}$ (12 kolom $\times$ 8 baris, total 96 frame berukuran $32 \times 32\text{ px}$).  
Struktur LPC RPG Maker membagi gambar menjadi **2 Set Karakter** (@ 4 karakter per set, masing-masing memiliki 4 baris arah):
* **Set 0 (Baris 0–3):** Char 0 (Player), Char 1 (Rexa), Char 2 (Manager), Char 3 (Pak Budi).
* **Set 1 (Baris 4–7):** Char 4 (Citra), Char 5 (Maya), Char 6 (Rian), Char 7 (Cadangan).

### Formula Frame Index Generator:
Untuk karakter ke-$\text{charIdx}$ ($0 \le \text{charIdx} \le 7$) dan arah ke-$\text{dirIdx}$ ($0=\text{Down}, 1=\text{Left}, 2=\text{Right}, 3=\text{Up}$):

$$\text{Set Index} = \lfloor \text{charIdx} / 4 \rfloor$$
$$\text{Col In Set} = \text{charIdx} \pmod 4$$
$$\text{Row Offset} = \left(\text{Set Index} \times 4 + \text{dirIdx}\right) \times 12$$
$$\text{Base Frame} = \text{Row Offset} + \left(\text{Col In Set} \times 3\right)$$
$$\text{Frames Walk} = [\text{Base Frame}, \text{Base Frame} + 1, \text{Base Frame} + 2]$$
$$\text{Frame Idle} = \text{Base Frame} + 1$$

Formula ini mencegah pergeseran vertikal antarkarakter (*spritesheet bleeding*) dan menjamin animasi berjalan 100% mulus.

---

## 5. Skema Denah & Tata Letak Ruang Kantor (Grid 24×16)

```
       01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23
    00 █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █  █ 00
    01 █ [RAK] [WHITE] 🖥️ █ ☕ [WB] [SMART SCREEN] 🌿 █ █ [RAK] [ARSIP] █ 01
    02 █               [RIAN]               [BUDI]                   █ 02
    03 █    [MEJA REXA] █    [CITRA] [MEJA MEETING]     █    [MEJA MGR]  █ 03
    04 █      (Rexa)    █       (Kursi Rapat)           █       (Mgr)    █ 04
    05 █                ░                               ░                █ 05
    06 █ 🌿             █                               █             🌿 █ 06
    07 █ ══ ══ ══    ══ ══ ══ ══ ══ ══    ══ ══ ══ ══ ══ ══    ══ ══ ══ █ 07
    08 █          [RAK] │                               │                █ 08
    09 █ [PANTRY] ☕    │           WALKWAY             │ [PRINT] [ARSIP]█ 09
    10 █                │                               │                █ 10
    11 █ [SOFA LOUNGE]  │                               │    [HOT-DESK]  █ 11
    12 █ [SOFA] [TABLE] │                               │ [MAYA]         █ 12
    13 █                │         🚶 PLAYER SPAWN       │                █ 13
    14 █ 🌿             │    🌿  [WELCOME MAT]  🌿      │             🌿 █ 14
    15 █  █  █  █  █  █  █  █  █  █  ░  ░  █  █  █  █  █  █  █  █  █  █  █  █ 15
```

### Keterangan Simbol:
* `█` = Dinding solid perimeter 2.5D
* `══` = Sekat akustik kayu arsitektural (*walnut slats*)
* `│` = Pembatas koridor terbuka
* `░` = Pintu masuk / bukaan partisi
* `🌿` = Tanaman hias pot terracotta (*Potted Monstera/Ficus*)

---

## 6. Spesifikasi Komponen UI Baru (React EventBus)

Untuk melengkapi `ThoughtBubble.jsx` dan `ApprovalModal.jsx` yang sudah ada, 4 modal baru akan disiapkan:

1. **`StockOpnameModal.jsx` (Triggered by Maya):**
   * Menampilkan tabel SKU yang berselisih hitung fisik di Toko 74.
   * Form pencatatan stok fisik baru (`POST /sku/{id}/stok-fisik`).
   * Tombol 1-Click *"Selesaikan Audit"* (`DELETE /sku/{id}/stok-fisik`).
   * Badge indikator status *Data Confidence Score*.

2. **`ReallocationModal.jsx` (Triggered by Citra):**
   * Ringkasan modal yang diselamatkan dari penahanan SKU *slow-moving* (`GET /holds`).
   * Tabel alokasi dana ke SKU bertren naik (`GET /stores/74/reallocation`).
   * Rincian dana kas bebas (*free cash*) vs anggaran uji pasar 10% (*exploration budget*).

3. **`GuardrailModal.jsx` (Triggered by Rian):**
   * Visualisasi status *Circuit Breaker* (Lampu Indikator Hijau/Merah).
   * Monitor real-time total nominal PO yang diterbitkan hari ini vs limit harian Rp 50 Juta.
   * Tombol 1-Click *"Reset Circuit Breaker"* (`POST /guardrails/circuit-breaker/reset`).
   * Tombol *"Reset Demo State"* (`POST /demo/reset`) untuk persiapan presentasi.

4. **`StoreIntelligenceModal.jsx` (Triggered by Pak Budi):**
   * 3 Gauge Meteran *Inventory Health Score* (Ketersediaan, Perputaran, Stabilitas Kas).
   * Valuasi nilai persediaan toko dalam Rupiah.
   * Daftar SKU berisiko tinggi mengalami *stockout*.
   * Dropdown pemilih toko cabang (Store 74, Store 2, dll).

---

## 7. Rencana Tahapan Eksekusi

Setelah proposal ini disetujui, implementasi akan dijalankan secara modular:
* **Tahap 1:** Update `MainScene.js` (Registrasi frame spritesheet Char 3, 4, 5, 6, spawn sprites NPC baru di titik koordinat, deteksi proximity, dan event emission).
* **Tahap 2:** Pembuatan komponen modal React (`StockOpnameModal`, `ReallocationModal`, `GuardrailModal`, `StoreIntelligenceModal`).
* **Tahap 3:** Integrasi interaksi hotkey `[E]` dan testing verifikasi *build* Vite.
