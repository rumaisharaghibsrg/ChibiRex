# Deploy dan Demo Rexa di AWS

Panduan untuk penanggung jawab deploy dan presenter. Kondisi per 22 Okt 2026.

## Arsitektur online

| Bagian | Di mana | Keterangan |
|---|---|---|
| Dashboard | AWS Amplify `rexa-dashboard` (cabang `main`) | https://main.d30b19xkk8lknt.amplifyapp.com |
| API (tools, guardrail, tiruan SAP) | AWS Lambda `chibirex-api-function`, container image ECR `chibirex-api`, Function URL | Region `ap-southeast-2`, akun proyek tim (Moonshot Mode) |
| Data analitik (Vs, ROP, skor risiko) | DuckDB di dalam image | Hanya dibaca |
| Data transaksi (PO, hold, jejak agent, audit) dan tiruan SAP | Amazon EFS `rexa-state`, access point `/rexa`, terpasang di `/mnt/rexa` | Dipakai bersama semua instance Lambda dan tidak hilang saat cold start |
| Jaringan | Lambda di VPC default dengan security group `rexa-lambda`; EFS hanya menerima NFS dari grup itu (`rexa-efs`) | Lambda tidak butuh akses internet keluar |
| Agent (LLM) | **Laptop**: Ollama `qwen3:14b` lewat worker `python -m agent.worker` | Tombol dashboard → antrian di API → worker mengambil tugas → setiap langkah dilaporkan ke API |

Kenapa LLM di laptop: di akun proyek tim, kuota Bedrock untuk semua model Nova bernilai 0 dan tidak bisa dinaikkan, dan kartu ditolak saat membuat akun standar (keputusan 22 Okt, `progress.md`). Semua aksi agent tetap lewat API di Lambda, jadi guardrail, persetujuan manajer, dan tiruan SAP berjalan di AWS. Mentor mengizinkan sebagian demo berjalan lokal.

Variabel lingkungan Lambda: `CHIBIREX_STATE_DB`, `CHIBIREX_SAP_MOCK_DB` (keduanya di `/mnt/rexa`), `CHIBIREX_AGENT_MODE=antrian`, `CHIBIREX_WORKER_TOKEN` (rahasia), `CHIBIREX_CORS_ORIGINS` (localhost, Vercel, Amplify).

## Persiapan laptop demo (sekali)

1. Repo + `.venv` + Ollama dengan `qwen3:14b`.
2. File `.env` di root repo (tidak ikut git) berisi dua baris:
   ```
   CHIBIREX_WORKER_API_URL=<Function URL Lambda>
   CHIBIREX_WORKER_TOKEN=<sama dengan CHIBIREX_WORKER_TOKEN di Lambda>
   ```
   Function URL: `aws lambda get-function-url-config --function-name chibirex-api-function --profile rexa --region ap-southeast-2`. Token terlihat di konsol Lambda → Configuration → Environment variables. Kirim token hanya lewat jalur pribadi, jangan di grup atau repo.
3. (Disarankan) Worker otomatis saat login, supaya tidak perlu membuka terminal: `powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1`. Skrip ini menaruh `Rexa Worker.vbs` di folder Startup Windows; worker berjalan tanpa jendela, log-nya di `logs\worker.log`, dan dijalankan ulang otomatis kalau berhenti. Cek dengan `-Status`, lepas dengan `-Hapus`. Ollama sudah otomatis jalan saat login dari instalasinya.

## Urutan demo

1. Nyalakan Ollama, lalu panaskan model supaya run pertama tidak lambat: `ollama run qwen3:14b "halo"`.
2. Bersihkan data demo (nomor PO SAP kembali ke 4500000001, tanggal simulasi kembali ke 31 Des 2016): `python -m agent.reset_demo`.
3. Pastikan worker berjalan. Kalau sudah dipasang otomatis: `powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1 -Status` harus menampilkan "worker AKTIF". Kalau belum dipasang, jalankan `python -m agent.worker` dan biarkan terminalnya terbuka.
4. Buka dashboard Amplify. Pastikan di panel agent tertulis **"LLM di laptop: worker aktif"**. Buka dashboard sekali beberapa menit sebelum presentasi, supaya cold start Lambda (±5–8 detik) tidak terjadi saat tampil.
5. Klik **Jalankan Agent**. Langkah agent tampil dalam ±40–60 detik. Setelah itu lakukan **1-Click Approval** untuk satu draf PO dan tunjukkan nomor PO SAP.
   Lalu majukan waktu lewat kontrol tanggal di kanan atas (**+7 hari**, atau **Otomatis 1 hari / 10 dtk**): stok berkurang, PO yang disetujui berstatus "Dalam pengiriman" lalu "Sudah tiba", dan Health Score serta daftar prioritas berubah. Jalankan agent lagi untuk menunjukkan ia bereaksi ke kondisi baru. Jeda mode otomatis sebelum menjelaskan angka.
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
- **Dashboard**: `powershell -ExecutionPolicy Bypass -File deploy\deploy_dashboard.ps1` (build dengan alamat API dari Lambda, lalu upload ke Amplify).
- Jangan deploy dari salinan kode lain selain repo ini, supaya versi terbaru tidak tertimpa.

## Kalau bermasalah

| Gejala | Penyebab dan solusi |
|---|---|
| "worker tidak aktif" di dashboard | Worker belum jalan, laptop tertidur, atau `CHIBIREX_WORKER_API_URL` salah. Worker otomatis: lihat `deploy\worker_otomatis.ps1 -Status` dan `logs\worker.log` |
| Worker: "Token worker ditolak" | `CHIBIREX_WORKER_TOKEN` di `.env` berbeda dengan di Lambda |
| Agent GAGAL "Tidak ada worker agent yang mengambil tugas" | Tidak ada worker yang mengambil tugas dalam 30 detik; jalankan worker lalu klik lagi |
| Request pertama lambat | Cold start Lambda (VPC + DuckDB). Buka dashboard sekali sebelum presentasi |
| Galat CORS di browser | Domain dashboard belum ada di `CHIBIREX_CORS_ORIGINS` di Lambda |
| `aws` minta login lagi | Sesi CLI kedaluwarsa; `aws login --profile rexa` |

## Biaya

EFS beberapa sen per bulan; Lambda, Amplify, dan ECR praktis gratis untuk pemakaian demo. Worker mengecek antrian setiap 2 detik (±43 ribu request Lambda per hari selama menyala), masih jauh di bawah kuota gratis bulanan kalau worker dimatikan setelah dipakai. Image lama di ECR (±700 MB per image) boleh dihapus untuk menghemat.
