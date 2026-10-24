<#
Worker agent otomatis saat login Windows (opsi 4: LLM di laptop), supaya tombol "Jalankan Agent" di dashboard bisa
langsung dipakai tanpa membuka terminal dan mengetik  python -m agent.worker.

Pemasangan menaruh "Rexa Worker.vbs" di folder Startup Windows. Saat login, file itu menjalankan skrip ini dengan
-Jalan tanpa jendela: worker berjalan di latar, keluarannya ditulis ke logs\worker.log, dan kalau worker berhenti ia
dijalankan ulang setelah 30 detik. Ollama sendiri sudah otomatis jalan saat login (bawaan instalasinya).

Prasyarat: .venv repo dan .env berisi CHIBIREX_WORKER_API_URL + CHIBIREX_WORKER_TOKEN (lihat docs/deploy.md).
  powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1           # pasang + jalankan sekarang
  powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1 -Status   # proses, status di API, log terakhir
  powershell -ExecutionPolicy Bypass -File deploy\worker_otomatis.ps1 -Hapus    # hentikan + lepas dari Startup
#>
param(
    [switch]$Status,
    [switch]$Hapus,
    [switch]$Jalan  # dipakai file Startup; tidak perlu dijalankan manual
)
$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Repo ".venv\Scripts\python.exe"
$LogDir = Join-Path $Repo "logs"
$Log = Join-Path $LogDir "worker.log"
$Vbs = Join-Path ([Environment]::GetFolderPath("Startup")) "Rexa Worker.vbs"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Tulis-Log([string]$Pesan) {
    [IO.File]::AppendAllText($Log, "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Pesan`r`n", $Utf8)
}

# Penjaga (powershell ... -Jalan) beserta worker Python-nya (cmd, launcher .venv, dan interpreter aslinya).
function Proses-Worker {
    Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -ne $PID -and $_.CommandLine -and
        ($_.CommandLine -like "*worker_otomatis.ps1*-Jalan*" -or $_.CommandLine -like "*-m agent.worker*")
    }
}

function Tampilkan-Status {
    if (Test-Path $Vbs) { "Startup  : terpasang ($Vbs)" } else { "Startup  : belum terpasang" }
    $python = @(Proses-Worker | Where-Object { $_.Name -eq "python.exe" -and $_.CommandLine -like "*-m agent.worker*" })
    "Proses   : $(if ($python.Count) { 'worker Python berjalan' } else { 'worker tidak berjalan' })"
    $baris = Get-Content (Join-Path $Repo ".env") -ErrorAction SilentlyContinue |
        Where-Object { $_ -match '^\s*CHIBIREX_WORKER_API_URL\s*=' } | Select-Object -First 1
    if ($baris) {
        $url = ($baris -replace '^[^=]*=', '').Trim().Trim('"').TrimEnd('/')
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        try {
            $s = Invoke-RestMethod "$url/agent-runs/worker" -TimeoutSec 30
            "API      : mode $($s.mode), worker $(if ($s.aktif) { 'AKTIF' } else { 'tidak aktif' })"
        } catch {
            "API      : tidak bisa dicek ($($_.Exception.Message))"
        }
    }
    if (Test-Path $Log) {
        "--- 10 baris terakhir logs\worker.log ---"
        Get-Content $Log -Tail 10 -Encoding UTF8
    }
}

if ($Jalan) {
    # Hanya satu penjaga, walaupun file Startup dan perintah pasang sama-sama menjalankannya.
    $kunci = New-Object System.Threading.Mutex($false, "Local\RexaAgentWorker")
    try { $dapat = $kunci.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $dapat = $true }
    if (-not $dapat) { exit }
    New-Item -ItemType Directory -Force $LogDir | Out-Null
    while ($true) {
        if ((Test-Path $Log) -and (Get-Item $Log).Length -gt 5MB) { Move-Item -Force $Log "$Log.1" }
        Tulis-Log "Menjalankan worker agent"
        # -X utf8: log berisi teks Indonesia dan simbol; -u: log langsung tertulis, tidak menunggu buffer penuh.
        $p = Start-Process cmd.exe -WorkingDirectory $Repo -WindowStyle Hidden -PassThru -Wait `
            -ArgumentList "/c `"`"$Python`" -X utf8 -u -m agent.worker >> `"$Log`" 2>&1`""
        Tulis-Log "Worker berhenti (kode $($p.ExitCode)); dijalankan ulang dalam 30 detik"
        Start-Sleep -Seconds 30
    }
}

if ($Status) {
    Tampilkan-Status
    exit
}

if ($Hapus) {
    if (Test-Path $Vbs) { Remove-Item -Force $Vbs }
    # Penjaga dihentikan dulu supaya worker tidak dijalankan ulang.
    $semua = @(Proses-Worker)
    $semua | Where-Object { $_.CommandLine -like "*-Jalan*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    $semua | Where-Object { $_.CommandLine -notlike "*-Jalan*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    "Worker dihentikan dan dilepas dari Startup. Jalankan manual lagi dengan: python -m agent.worker"
    exit
}

# Pasang
if (-not (Test-Path $Python)) { throw "Tidak menemukan $Python. Buat .venv repo dulu." }
if (-not (Test-Path (Join-Path $Repo ".env"))) { throw "Tidak menemukan .env (CHIBIREX_WORKER_API_URL dan CHIBIREX_WORKER_TOKEN)." }
$skrip = Join-Path $PSScriptRoot "worker_otomatis.ps1"
$isi = @"
' Rexa: menjalankan worker agent tanpa jendela saat login.
' Dibuat oleh deploy\worker_otomatis.ps1; lepas dengan: deploy\worker_otomatis.ps1 -Hapus
CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$skrip"" -Jalan", 0, False
"@
[IO.File]::WriteAllText($Vbs, $isi, [Text.Encoding]::Unicode)
"Terpasang di Startup: $Vbs"
Start-Process wscript.exe -ArgumentList "`"$Vbs`""
"Worker dijalankan; menunggu 20 detik sampai terlihat di API..."
Start-Sleep -Seconds 20
Tampilkan-Status
