# Deploy dan Demo Rexa di AWS

Panduan untuk penanggung jawab deploy dan presenter. Kondisi per 22 Okt 2026.

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
| Agent (Strands) | **Laptop**: worker `python -m agent.worker` (otomatis saat login) | Tombol dashboard → antrian di API → worker mengambil tugas, memanggil Claude di Bedrock → setiap langkah dilaporkan ke API |

Kenapa worker masih di laptop: agent belum dipindah ke AWS (butuh deploy agent terpisah). Semua aksi agent tetap lewat API di Lambda, jadi guardrail, persetujuan manajer, dan tiruan SAP berjalan di AWS. Riwayat: sebelum 25 Okt, kuota Bedrock untuk model Nova bernilai 0, sehingga LLM-nya Ollama di laptop (keputusan 22 Okt, `progress.md`).

Variabel lingkungan Lambda: `CHIBIREX_STATE_DB`, `CHIBIREX_SAP_MOCK_DB` (keduanya di `/mnt/rexa`), `CHIBIREX_AGENT_MODE=antrian`, `CHIBIREX_WORKER_TOKEN` (rahasia), `CHIBIREX_CORS_ORIGINS` (localhost, Vercel, Amplify).

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

1. Laptop presenter menyala dan tersambung internet (worker memanggil Claude di Bedrock). Kalau memakai cadangan Ollama, panaskan modelnya dulu: `ollama run qwen3:14b "halo"`.
2. Bersihkan data demo (nomor PO SAP kembali ke 4500000001, tanggal simulasi kembali ke 31 Des 2016): `python -m agent.reset_demo`.
3. Pastikan worker berjalan. Kalau sudah dipasang otomatis: `powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1 -Status` harus menampilkan "worker AKTIF". Kalau belum dipasang, jalankan `python -m agent.worker` dan biarkan terminalnya terbuka.
4. Buka dashboard Amplify. Pastikan di panel agent tertulis **"Worker agent di laptop: aktif"**. Buka dashboard sekali beberapa menit sebelum presentasi, supaya cold start Lambda (±5–8 detik) tidak terjadi saat tampil.
5. Klik **Jalankan Agent**. Langkah agent tampil dalam ±20 detik (Claude Sonnet 4.6; ±40–60 detik dengan Ollama). Setelah itu lakukan **1-Click Approval** untuk satu draf PO dan tunjukkan nomor PO SAP.
   Lalu majukan waktu lewat kontrol tanggal di kanan atas (**+7**, atau **Otomatis 1 hari / 10 dtk**; **−1/−7** untuk mundur kalau terlalu jauh): stok berkurang, PO yang disetujui berstatus "Dalam pengiriman" lalu "Sudah tiba", dan Health Score serta daftar prioritas berubah. Jalankan agent lagi untuk menunjukkan ia bereaksi ke kondisi baru. Jeda mode otomatis sebelum menjelaskan angka. Tombol **Kembali ke 31 Des 2016** di menu yang sama mengembalikan tanggal dan stok ke data awal tanpa menghapus PO dan riwayat.
   Sudut pandang manajer area: buka menu **Semua Toko** (statistik 80 toko tanpa berpindah toko), klik **Analisis Semua Toko** (±25 detik, tidak butuh laptop), lalu **Buka toko** pada toko prioritas pertama dan jalankan agent toko itu.
   Versi visual: tombol **Mode Virtual HQ** di sidebar membuka kantor 2D untuk toko yang sama (staf membacakan data toko, Smart TV menampilkan statistik jaringan, Doni melaporkan krisis dari data); tombol **Dashboard** di header game kembali ke dashboard. Dari halaman **Semua Toko**, tombol yang sama membuka mode Semua Toko di Virtual HQ: staf melapor untuk seluruh jaringan dan Rexa menjalankan Agent Jaringan.
6. Skenario tambahan dari menu **Skenario Uji** di header dashboard: **Uji Runaway PO** (circuit breaker terbuka; manajer mereset di **Audit & Guardrails**), **Simulasi selisih stok** (lalu jalankan agent lagi), dan **Audit stok selesai**. Versi terminalnya, diarahkan ke API online:
   ```powershell
   $env:CHIBIREX_API_URL = "<Function URL Lambda>"
   python -m agent.skenario_selisih_stok --store 74      # lalu jalankan agent lagi; akhiri dengan --audit-selesai
   python -m agent.skenario_runaway --store 74
   ```
7. Setelah selesai, kembalikan data demo dengan `python -m agent.reset_demo`. Worker otomatis boleh dibiarkan; worker manual dihentikan dengan Ctrl+C.

## Deploy ulang

Login CLI berlaku sekitar 12 jam: `aws login --profile rexa`.

- **API**: Docker Desktop menyala, lalu `powershell -ExecutionPolicy Bypass -File deploy\deploy_lambda.ps1` (build, uji di kontainer, push ke ECR, perbarui Lambda; `-UjiSaja` untuk uji tanpa deploy). Konfigurasi VPC, EFS, dan variabel lingkungan tidak ikut berubah.
- **Chatbot Copilot**: `powershell -ExecutionPolicy Bypass -File deploy\deploy_copilot.ps1` (zip folder `copilot/`; membuat Lambda `rexa-copilot` kalau belum ada atau memperbaruinya, mengatur Function URL + CORS, lalu menguji satu pertanyaan). Lambda API ada di VPC tanpa internet keluar, jadi tidak bisa memanggil Bedrock; karena itu chatbot berjalan di Lambda terpisah di luar VPC.
- **Dashboard**: `powershell -ExecutionPolicy Bypass -File deploy\deploy_dashboard.ps1` (build dashboard dan Virtual HQ dengan alamat API dan, kalau ada, alamat Copilot dari Lambda; Virtual HQ dipasang di `dist/hq`; lalu upload ke Amplify). Deploy dashboard setelah Copilot pertama kali dibuat.
- Jangan deploy dari salinan kode lain selain repo ini, supaya versi terbaru tidak tertimpa.

## Kalau bermasalah

| Gejala | Penyebab dan solusi |
|---|---|
| "worker tidak aktif" di dashboard | Worker belum jalan, laptop tertidur, atau `CHIBIREX_WORKER_API_URL` salah. Worker otomatis: lihat `deploy\worker_otomatis.ps1 -Status` dan `logs\worker.log` |
| Worker: "Token worker ditolak" | `CHIBIREX_WORKER_TOKEN` di `.env` berbeda dengan di Lambda |
| Agent GAGAL "Tidak ada worker agent yang mengambil tugas" | Tidak ada worker yang mengambil tugas dalam 30 detik; jalankan worker lalu klik lagi |
| Request pertama lambat | Cold start Lambda (VPC + DuckDB). Buka dashboard sekali sebelum presentasi |
| Galat CORS di browser | Domain dashboard belum ada di `CHIBIREX_CORS_ORIGINS` di Lambda |
| Agent Jaringan: "belum bisa berjalan sekarang" | Lihat `aws logs tail /aws/lambda/rexa-copilot --profile rexa --region ap-southeast-2` (cari `JARINGAN_GAGAL`): Bedrock menolak model, atau Lambda API lambat saat cold start; coba lagi |
| `aws` minta login lagi | Sesi CLI kedaluwarsa; `aws login --profile rexa` |

## Biaya

EFS beberapa sen per bulan; Lambda, Amplify, dan ECR praktis gratis untuk pemakaian demo. Worker mengecek antrian setiap 2 detik (±43 ribu request Lambda per hari selama menyala), masih jauh di bawah kuota gratis bulanan kalau worker dimatikan setelah dipakai. Image lama di ECR (±700 MB per image) boleh dihapus untuk menghemat. Token Bedrock berbayar: satu run agent toko atau satu Analisis Semua Toko (Sonnet 4.6, ±25-35 ribu token masuk dan ±2 ribu keluar) sekitar US$0,10-0,15; satu pertanyaan chatbot (Haiku 4.5) jauh lebih murah.
