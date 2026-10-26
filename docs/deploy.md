# Deploy dan Demo Rexa di AWS

Panduan untuk penanggung jawab deploy dan presenter. Kondisi per 26 Okt 2026.

## Arsitektur online

| Bagian | Di mana | Keterangan |
|---|---|---|
| Dashboard | AWS Amplify `rexa-dashboard` (cabang `main`) | https://main.d30b19xkk8lknt.amplifyapp.com |
| Virtual HQ (kantor 2D) | Amplify yang sama, subfolder `/hq/` | https://main.d30b19xkk8lknt.amplifyapp.com/hq/index.html, dibuka dari tombol **Mode Virtual HQ** di sidebar dashboard (toko yang sedang dibuka ikut terbawa). Origin sama dengan dashboard, jadi CORS API dan Copilot tidak perlu diubah |
| API (tools, guardrail, tiruan SAP) | AWS Lambda `chibirex-api-function`, container image ECR `chibirex-api`, Function URL | Region `ap-southeast-2`, akun proyek tim (Moonshot Mode) |
| Data analitik (Vs, ROP, skor risiko) | DuckDB di dalam image | Hanya dibaca |
| Data transaksi (PO, hold, jejak agent, audit) dan tiruan SAP | Amazon EFS `rexa-state`, access point `/rexa`, terpasang di `/mnt/rexa` | Dipakai bersama semua instance Lambda dan tidak hilang saat cold start |
| Jaringan | Lambda di VPC default dengan security group `rexa-lambda`; EFS hanya menerima NFS dari grup itu (`rexa-efs`) | Lambda tidak butuh akses internet keluar |
| LLM | **Amazon Bedrock**: Claude Sonnet 4.6 (`au.anthropic.claude-sonnet-4-6`, `ap-southeast-2`), lewat API key Bedrock | Sejak 25 Okt 2026. Ollama `qwen3:14b` di laptop tetap bisa dipakai sebagai cadangan (`CHIBIREX_LLM_PROVIDER=ollama`) |
| Chatbot Copilot dan Agent Jaringan | AWS Lambda `rexa-copilot` (zip, Python 3.12, **di luar VPC**, timeout 120 detik), Function URL publik dengan CORS untuk dashboard | Chatbot (`POST /tanya`): Claude Haiku 4.5 (lebih hemat). Agent Jaringan halaman "Semua Toko" (`POST /jaringan`): Claude Sonnet 4.6. Lewat IAM role, tanpa API key; membaca data lewat Function URL API, hanya GET. Tidak butuh laptop. Ganti model: `deploy\deploy_copilot.ps1 -Model <id> -ModelJaringan <id>` |
| Agent toko (Strands) | **Amazon Bedrock AgentCore Runtime** `rexa_agent_toko` (kode Python 3.13 ARM64 dari S3, tanpa container), dipasang oleh `deploy\deploy_agent.ps1`. Cadangan: worker `python -m agent.worker` di laptop | Tombol dashboard → tugas masuk antrian API → dashboard meminta Lambda Copilot (`POST /agent`) membangunkan runtime → runtime mengambil tugas, memanggil Claude Sonnet 4.6 di Bedrock dengan role-nya sendiri → setiap langkah dilaporkan ke API. **Tidak butuh laptop.** Tugas diambil oleh yang lebih dulu meminta, jadi worker laptop boleh tetap menyala |

Kenapa pemicunya lewat Lambda Copilot: Lambda API ada di VPC tanpa akses internet keluar, jadi tidak bisa memanggil AgentCore, dan browser tidak punya kredensial AWS. Copilot (di luar VPC) memanggil `InvokeAgentRuntime` dengan izin role-nya; runtime langsung menjawab lalu bekerja di latar (sesi baru per run, ditutup 2 menit setelah menganggur). Agent memakai token worker yang sama dengan laptop, dan semua aksinya tetap lewat API di Lambda, jadi guardrail, persetujuan manajer, dan tiruan SAP tidak berubah. Riwayat: sebelum 25 Okt, kuota Bedrock untuk model Nova bernilai 0, sehingga LLM-nya Ollama di laptop (keputusan 22 Okt); sampai AgentCore di-deploy, agent hanya berjalan lewat worker di laptop.

Variabel lingkungan Lambda API: `CHIBIREX_STATE_DB`, `CHIBIREX_SAP_MOCK_DB` (keduanya di `/mnt/rexa`), `CHIBIREX_AGENT_MODE=antrian`, `CHIBIREX_WORKER_TOKEN` (rahasia), `CHIBIREX_CORS_ORIGINS` (localhost, Vercel, Amplify), dan `CHIBIREX_AGENTCORE=1` setelah agent di AgentCore (dashboard lalu menulis "Agent berjalan di Amazon Bedrock AgentCore" alih-alih meminta laptop dinyalakan). Lambda Copilot menyimpan ARN runtime di `AGENT_RUNTIME_ARN`.

## Persiapan laptop demo (sekali)

1. Repo + `.venv`. Ollama dengan `qwen3:14b` hanya perlu kalau ingin cadangan LLM lokal.
2. File `.env` di root repo (tidak ikut git):
   ```
   CHIBIREX_WORKER_API_URL=<Function URL Lambda>
   CHIBIREX_WORKER_TOKEN=<sama dengan CHIBIREX_WORKER_TOKEN di Lambda>
   AWS_BEARER_TOKEN_BEDROCK=<API key Bedrock, diawali ABSK>
   CHIBIREX_LLM_PROVIDER=bedrock
   CHIBIREX_BEDROCK_REGION=ap-southeast-2
   CHIBIREX_BEDROCK_MODEL_ID=au.anthropic.claude-sonnet-4-6
   ```
   Function URL: `aws lambda get-function-url-config --function-name chibirex-api-function --profile rexa --region ap-southeast-2`. Token terlihat di konsol Lambda → Configuration → Environment variables. API key Bedrock dibuat di konsol Bedrock → *API keys* (salin kolom **API Key**, bukan **Name**); cek dengan `python -m agent.cek_bedrock --claude`. Token dan API key hanya lewat jalur pribadi, jangan di grup, chat, atau repo.
3. (Disarankan) Worker otomatis saat login, supaya tidak perlu membuka terminal: `powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1`. Skrip ini menaruh `Rexa Worker.vbs` di folder Startup Windows; worker berjalan tanpa jendela, log-nya di `logs\worker.log`, dan dijalankan ulang otomatis kalau berhenti. Cek dengan `-Status`, lepas dengan `-Hapus`. Ollama sudah otomatis jalan saat login dari instalasinya.

## Urutan demo

1. Laptop presenter hanya perlu browser. Agent berjalan di Bedrock AgentCore; laptop baru wajib menyala kalau AgentCore belum di-deploy (worker di laptop) atau memakai cadangan Ollama (panaskan dulu: `ollama run qwen3:14b "halo"`).
2. Bersihkan data demo (nomor PO SAP kembali ke 4500000001, tanggal simulasi kembali ke 31 Des 2016): `python -m agent.reset_demo`.
3. Tanpa AgentCore saja: pastikan worker di laptop berjalan (`powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1 -Status` harus menampilkan "worker AKTIF", atau jalankan `python -m agent.worker`).
4. Buka dashboard Amplify. Di panel agent harus tertulis **"Agent berjalan di Amazon Bedrock AgentCore"** (atau "Worker agent di laptop: aktif" kalau memakai worker). Buka dashboard sekali beberapa menit sebelum presentasi, supaya cold start Lambda (±5–8 detik) tidak terjadi saat tampil, dan jalankan agent sekali untuk memastikan semuanya tersambung.
5. Klik **Jalankan Agent**. Langkah agent tampil dalam ±20 detik (Claude Sonnet 4.6; sesi AgentCore baru menambah beberapa detik di awal; ±40–60 detik dengan Ollama). Setelah itu lakukan **1-Click Approval** untuk satu draf PO dan tunjukkan nomor PO SAP.
   Lalu majukan waktu lewat kontrol tanggal di kanan atas (**+7**, atau **Otomatis 1 hari / 10 dtk**; **−1/−7** untuk mundur kalau terlalu jauh): stok berkurang, PO yang disetujui berstatus "Dalam pengiriman" lalu "Sudah tiba", dan Health Score serta daftar prioritas berubah. Jalankan agent lagi untuk menunjukkan ia bereaksi ke kondisi baru. Jeda mode otomatis sebelum menjelaskan angka. Tombol **Kembali ke 31 Des 2016** di menu yang sama mengembalikan tanggal dan stok ke data awal tanpa menghapus PO dan riwayat.
   Sudut pandang manajer area: buka menu **Semua Toko** (statistik 80 toko tanpa berpindah toko), klik **Analisis Semua Toko** (±25 detik, tidak butuh laptop), lalu **Buka toko** pada toko prioritas pertama dan jalankan agent toko itu.
   Versi visual: tombol **Mode Virtual HQ** di sidebar membuka kantor 2D untuk toko yang sama (staf membacakan data toko, Smart TV menampilkan statistik jaringan, Doni melaporkan krisis dari data); tombol **Dashboard** di header game kembali ke dashboard. Dari halaman **Semua Toko**, tombol yang sama membuka mode Semua Toko di Virtual HQ: staf melapor untuk seluruh jaringan dan Rexa menjalankan Agent Jaringan.
6. Skenario tambahan dari menu **Skenario Uji** di header dashboard: **Uji Runaway PO** (circuit breaker terbuka; manajer mereset di **Audit & Guardrails**), **Simulasi selisih stok** (lalu jalankan agent lagi), dan **Audit stok selesai**. Versi terminalnya, diarahkan ke API online:
   ```powershell
   $env:CHIBIREX_API_URL = "<Function URL Lambda>"
   python -m agent.skenario_selisih_stok --store 74      # lalu jalankan agent lagi; akhiri dengan --audit-selesai
   python -m agent.skenario_runaway --store 74
   ```
7. Setelah selesai, kembalikan data demo dengan `python -m agent.reset_demo`. Worker otomatis di laptop boleh dibiarkan atau dilepas (`-Hapus`); worker manual dihentikan dengan Ctrl+C.

## Deploy ulang

Login CLI berlaku sekitar 12 jam: `aws login --profile rexa`.

- **API**: Docker Desktop menyala, lalu `powershell -ExecutionPolicy Bypass -File deploy\deploy_lambda.ps1` (build, uji di kontainer, push ke ECR, perbarui Lambda; `-UjiSaja` untuk uji tanpa deploy). Konfigurasi VPC, EFS, dan variabel lingkungan tidak ikut berubah.
- **Chatbot Copilot**: `powershell -ExecutionPolicy Bypass -File deploy\deploy_copilot.ps1` (zip folder `copilot/`; membuat Lambda `rexa-copilot` kalau belum ada atau memperbaruinya, mengatur Function URL + CORS, lalu menguji satu pertanyaan). Lambda API ada di VPC tanpa internet keluar, jadi tidak bisa memanggil Bedrock; karena itu chatbot berjalan di Lambda terpisah di luar VPC.
- **Agent toko di Bedrock AgentCore**: `powershell -ExecutionPolicy Bypass -File deploy\deploy_agent.ps1`. Mengemas `agent/` dan dependensinya (`requirements-agentcore.txt`) untuk Linux ARM64 dengan `uv` (ada di `requirements.txt`), mengunggahnya ke bucket S3 `rexa-agentcore-<akun>-<region>`, membuat atau memperbarui role `rexa-agentcore-role` (hanya model Bedrock, kode di S3, dan log) dan runtime `rexa_agent_toko`, memberi role Lambda izin `InvokeAgentRuntime`, men-deploy ulang Copilot dengan ARN runtime, memasang `CHIBIREX_AGENTCORE=1` di Lambda API, lalu menguji runtime tanpa menjalankan agent (data demo tidak berubah). Setelah itu deploy ulang dashboard. Uji lokal tanpa AWS: `python -m agent.agentcore` (port 8080) lalu `POST http://127.0.0.1:8080/invocations`.
- **Dashboard**: `powershell -ExecutionPolicy Bypass -File deploy\deploy_dashboard.ps1` (build dashboard dan Virtual HQ dengan alamat API dan, kalau ada, alamat Copilot dari Lambda; Virtual HQ dipasang di `dist/hq`; lalu upload ke Amplify). Deploy dashboard setelah Copilot pertama kali dibuat.
- Jangan deploy dari salinan kode lain selain repo ini, supaya versi terbaru tidak tertimpa.

## Kalau bermasalah

| Gejala | Penyebab dan solusi |
|---|---|
| "worker tidak aktif" di dashboard | AgentCore belum di-deploy dan worker laptop belum jalan, laptop tertidur, atau `CHIBIREX_WORKER_API_URL` salah. Worker otomatis: lihat `deploy\worker_otomatis.ps1 -Status` dan `logs\worker.log` |
| Worker: "Token worker ditolak" | `CHIBIREX_WORKER_TOKEN` di `.env` berbeda dengan di Lambda. Kalau token Lambda diganti, jalankan juga `deploy\deploy_agent.ps1` supaya runtime AgentCore memakai token baru |
| Agent GAGAL "Agent di Bedrock AgentCore tidak mengambil tugas" | Runtime tidak mengambil tugas dalam 60 detik. Cek log Copilot (`aws logs tail /aws/lambda/rexa-copilot ...`, cari `AGENTCORE_GAGAL`) dan log runtime (`aws logs tail /aws/bedrock-agentcore/runtimes/<id runtime>-DEFAULT ...`, cari `AGENT_GAGAL`). Sementara itu worker laptop bisa dijalankan sebagai cadangan |
| Agent GAGAL "Tidak ada worker agent yang mengambil tugas" | AgentCore belum di-deploy dan tidak ada worker yang mengambil tugas dalam 60 detik; jalankan worker lalu klik lagi |
| Request pertama lambat | Cold start Lambda (VPC + DuckDB). Buka dashboard sekali sebelum presentasi |
| Galat CORS di browser | Domain dashboard belum ada di `CHIBIREX_CORS_ORIGINS` di Lambda |
| Agent Jaringan: "belum bisa berjalan sekarang" | Lihat `aws logs tail /aws/lambda/rexa-copilot --profile rexa --region ap-southeast-2` (cari `JARINGAN_GAGAL`): Bedrock menolak model, atau Lambda API lambat saat cold start; coba lagi |
| `aws` minta login lagi | Sesi CLI kedaluwarsa; `aws login --profile rexa` |

## Biaya

EFS beberapa sen per bulan; Lambda, Amplify, dan ECR praktis gratis untuk pemakaian demo. Worker mengecek antrian setiap 2 detik (±43 ribu request Lambda per hari selama menyala), masih jauh di bawah kuota gratis bulanan kalau worker dimatikan setelah dipakai. Image lama di ECR (±700 MB per image) boleh dihapus untuk menghemat. Runtime AgentCore ditagih per detik selama sesi hidup (satu run ±20-40 detik, sesi ditutup 2 menit setelah menganggur), jauh lebih kecil daripada token modelnya; zip kode di S3 ±30 MB per deploy. Token Bedrock berbayar: satu run agent toko atau satu Analisis Semua Toko (Sonnet 4.6, ±25-35 ribu token masuk dan ±2 ribu keluar) sekitar US$0,10-0,15; satu pertanyaan chatbot (Haiku 4.5) jauh lebih murah.
