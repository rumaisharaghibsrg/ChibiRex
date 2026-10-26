<#
Deploy agent Rexa (agent toko) ke Amazon Bedrock AgentCore Runtime, supaya agent tetap berjalan walaupun laptop mati.

Kode yang sama dengan worker di laptop (folder agent/, entrypoint agent/agentcore.py) dikemas sebagai zip Python
untuk Linux ARM64 tanpa container, diunggah ke S3, lalu dipasang sebagai runtime `rexa_agent_toko` dengan role
sendiri (hanya boleh memanggil model di Bedrock, membaca kodenya di S3, dan menulis log). Agent memanggil API Rexa
lewat Function URL dengan token worker, sama seperti worker di laptop, jadi guardrail dan persetujuan manajer tetap.

Setelah runtime READY, skrip ini juga:
- memberi role Lambda Copilot izin InvokeAgentRuntime, lalu deploy ulang Copilot (route POST /agent) dengan ARN runtime;
- menandai Lambda API (CHIBIREX_AGENTCORE=1) supaya dashboard tidak lagi meminta laptop dinyalakan;
- menguji: Copilot membangunkan runtime saat antrian kosong, lalu API harus mencatat "bedrock-agentcore" sebagai
  pengambil antrian. Tidak ada agent yang dijalankan saat uji, jadi data demo tidak berubah.

Prasyarat: .venv repo (berisi uv, lihat requirements.txt) dan login AWS CLI:  aws login --profile rexa
  powershell -ExecutionPolicy Bypass -File deploy\deploy_agent.ps1
Setelah itu deploy ulang dashboard (deploy\deploy_dashboard.ps1) supaya tombol agent membangunkan AgentCore.
#>
param(
    [string]$Profil = "rexa",
    [string]$Region = "ap-southeast-2",
    [string]$Nama = "rexa_agent_toko",
    [string]$Role = "rexa-agentcore-role",
    [string]$FungsiApi = "chibirex-api-function",
    [string]$FungsiCopilot = "rexa-copilot",
    [string]$Model = "au.anthropic.claude-sonnet-4-6"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Cek([string]$Langkah) {
    if ($LASTEXITCODE -ne 0) { throw "Gagal: $Langkah" }
}

$aws = @("--profile", $Profil, "--region", $Region)
# Folder kerja sementara. Berisi token worker, jadi selalu dihapus di akhir (blok finally).
$tmp = Join-Path $env:TEMP "rexa-agentcore"
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Force $tmp | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Argumen JSON untuk AWS CLI ditulis ke file, karena tanda kutip di baris perintah PowerShell 5.1 mudah rusak.
function Tulis-Json([string]$Nama, $Isi) {
    $path = Join-Path $tmp $Nama
    [IO.File]::WriteAllText($path, ($Isi | ConvertTo-Json -Depth 10 -Compress), $utf8)
    return "file://" + $path.Replace("\", "/")
}

# Perintah AWS CLI yang boleh gagal (misalnya "belum ada"): hasilnya $null, skrip tidak berhenti.
function Coba-Aws {
    $ErrorActionPreference = "Continue"  # di PowerShell 5.1, stderr perintah native memicu galat kalau "Stop"
    $hasil = & aws @args 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return ($hasil -join "`n").Trim()
}

try {
    Write-Host "1. Cek AgentCore di $Region, lalu baca akun, alamat API, role Lambda, dan token worker"
    if ($null -eq (Coba-Aws bedrock-agentcore-control list-agent-runtimes --max-results 1 @aws)) {
        throw "Bedrock AgentCore tidak bisa dipakai di $Region (belum login, region belum didukung, atau izin kurang). Jalankan dulu: aws login --profile $Profil"
    }
    $akun = (aws sts get-caller-identity --profile $Profil --query Account --output text).Trim()
    Cek "membaca akun AWS"
    $apiUrl = (aws lambda get-function-url-config --function-name $FungsiApi @aws --query FunctionUrl --output text).Trim().TrimEnd("/")
    Cek "membaca URL Lambda API"
    $roleLambda = (aws lambda get-function-configuration --function-name $FungsiApi @aws --query Role --output text).Trim()
    Cek "membaca role Lambda API"
    $envApi = (aws lambda get-function-configuration --function-name $FungsiApi @aws --query "Environment.Variables" --output json) -join "`n" | ConvertFrom-Json
    Cek "membaca konfigurasi Lambda API"
    $token = $envApi.CHIBIREX_WORKER_TOKEN
    if (-not $token) { throw "Lambda API belum memakai CHIBIREX_WORKER_TOKEN; agent di AgentCore butuh token yang sama." }
    if ($envApi.CHIBIREX_AGENT_MODE -ne "antrian") { throw "Lambda API tidak dalam mode antrian (CHIBIREX_AGENT_MODE)." }

    Write-Host "2. Kemas agent/ dan dependensinya untuk Linux ARM64 (Python 3.13)"
    $paket = Join-Path $tmp "paket"
    # uv (bukan pip) karena penanda platform dependensi harus dinilai untuk Linux, bukan Windows (misalnya pywin32).
    $ErrorActionPreference = "Continue"
    & .venv\Scripts\python.exe -m uv pip install --quiet --python-platform aarch64-manylinux2014 --python-version 3.13 `
        --only-binary :all: --target $paket -r requirements-agentcore.txt
    $ErrorActionPreference = "Stop"
    Cek "memasang dependensi (butuh uv: .venv\Scripts\python.exe -m pip install -r requirements.txt)"
    $zip = Join-Path $tmp "agent.zip"
    & .venv\Scripts\python.exe -I -c @"
import pathlib, sys, zipfile
paket, tujuan = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
with zipfile.ZipFile(tujuan, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in paket.rglob('*'):
        if f.is_file() and '__pycache__' not in f.parts:
            z.write(f, f.relative_to(paket).as_posix())
    for f in [*pathlib.Path('agent').glob('*.py'), pathlib.Path('engine/__init__.py'), pathlib.Path('engine/config.py')]:
        z.write(f, f.as_posix())
print(f'   zip {tujuan.stat().st_size / 1e6:.1f} MB')
"@ $paket $zip
    Cek "membuat zip"

    Write-Host "3. Unggah kode ke S3"
    $bucket = "rexa-agentcore-$akun-$Region"
    if ($null -eq (Coba-Aws s3api head-bucket --bucket $bucket @aws)) {
        aws s3api create-bucket --bucket $bucket --create-bucket-configuration "LocationConstraint=$Region" @aws | Out-Null
        Cek "membuat bucket S3"
        aws s3api put-public-access-block --bucket $bucket @aws `
            --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
        Cek "menutup akses publik bucket"
    }
    $kunci = "$Nama/kode-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"  # kunci baru tiap deploy, supaya versi baru terbaca
    aws s3 cp $zip "s3://$bucket/$kunci" @aws --only-show-errors
    Cek "mengunggah zip"

    Write-Host "4. Role runtime ($Role): hanya model di Bedrock, kode di S3, dan log"
    $percaya = Tulis-Json "percaya.json" @{ Version = "2012-10-17"; Statement = @(@{
        Effect = "Allow"; Principal = @{ Service = "bedrock-agentcore.amazonaws.com" }; Action = "sts:AssumeRole"
        Condition = @{ StringEquals = @{ "aws:SourceAccount" = $akun }
                       ArnLike = @{ "aws:SourceArn" = "arn:aws:bedrock-agentcore:${Region}:${akun}:*" } } }) }
    $roleArn = Coba-Aws iam get-role --role-name $Role --profile $Profil --query Role.Arn --output text
    $roleBaru = -not $roleArn
    if ($roleBaru) {
        $roleArn = (aws iam create-role --role-name $Role --assume-role-policy-document $percaya --profile $Profil `
            --description "Rexa: agent toko di Bedrock AgentCore Runtime" --query Role.Arn --output text).Trim()
        Cek "membuat role $Role"
    } else {
        aws iam update-assume-role-policy --role-name $Role --policy-document $percaya --profile $Profil
        Cek "memperbarui trust policy $Role"
    }
    $izin = Tulis-Json "izin.json" @{ Version = "2012-10-17"; Statement = @(
        @{ Sid = "Claude"; Effect = "Allow"; Action = @("bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream")
           Resource = @("arn:aws:bedrock:*::foundation-model/*", "arn:aws:bedrock:*:${akun}:inference-profile/*") },
        @{ Sid = "Kode"; Effect = "Allow"; Action = "s3:GetObject"; Resource = "arn:aws:s3:::$bucket/$Nama/*" },
        @{ Sid = "Log"; Effect = "Allow"
           Action = @("logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams")
           Resource = "arn:aws:logs:${Region}:${akun}:log-group:/aws/bedrock-agentcore/runtimes/*" },
        @{ Sid = "DaftarLog"; Effect = "Allow"; Action = "logs:DescribeLogGroups"; Resource = "arn:aws:logs:${Region}:${akun}:log-group:*" },
        @{ Sid = "Jejak"; Effect = "Allow"; Resource = "*"
           Action = @("xray:PutTraceSegments", "xray:PutTelemetryRecords", "xray:GetSamplingRules", "xray:GetSamplingTargets") },
        @{ Sid = "Metrik"; Effect = "Allow"; Action = "cloudwatch:PutMetricData"; Resource = "*"
           Condition = @{ StringEquals = @{ "cloudwatch:namespace" = "bedrock-agentcore" } } }) }
    aws iam put-role-policy --role-name $Role --policy-name rexa-agentcore --policy-document $izin --profile $Profil
    Cek "memasang izin role $Role"
    if ($roleBaru) {
        Write-Host "   Menunggu role baru berlaku..."
        Start-Sleep -Seconds 15
    }

    Write-Host "5. Pasang runtime $Nama"
    $artefak = Tulis-Json "artefak.json" @{ codeConfiguration = @{
        code = @{ s3 = @{ bucket = $bucket; prefix = $kunci } }; runtime = "PYTHON_3_13"; entryPoint = @("agent/agentcore.py") } }
    $jaringan = Tulis-Json "jaringan.json" @{ networkMode = "PUBLIC" }
    # Satu sesi per run (copilot/agentcore.py). Setelah agent selesai, sesi yang menganggur 2 menit ditutup.
    $siklus = Tulis-Json "siklus.json" @{ idleRuntimeSessionTimeout = 120; maxLifetime = 3600 }
    $lingkungan = Tulis-Json "env-agent.json" @{
        CHIBIREX_LLM_PROVIDER = "bedrock"; CHIBIREX_BEDROCK_MODEL_ID = $Model; CHIBIREX_BEDROCK_REGION = $Region
        CHIBIREX_WORKER_API_URL = $apiUrl; CHIBIREX_WORKER_TOKEN = $token
        DOCKER_CONTAINER = "1"  # bedrock_agentcore mendengarkan di 0.0.0.0, bukan hanya 127.0.0.1
        PYTHONUNBUFFERED = "1" }
    $umum = @("--agent-runtime-artifact", $artefak, "--role-arn", $roleArn, "--network-configuration", $jaringan,
              "--lifecycle-configuration", $siklus, "--environment-variables", $lingkungan,
              "--description", "Rexa: agent toko (Strands + Claude di Bedrock), mengambil tugas dari antrian API")
    $runtimeId = Coba-Aws bedrock-agentcore-control list-agent-runtimes @aws `
        --query "agentRuntimes[?agentRuntimeName=='$Nama'].agentRuntimeId | [0]" --output text
    if (-not $runtimeId -or $runtimeId -eq "None") {
        $runtimeId = (aws bedrock-agentcore-control create-agent-runtime --agent-runtime-name $Nama @umum @aws `
            --query agentRuntimeId --output text).Trim()
        Cek "create-agent-runtime"
    } else {
        aws bedrock-agentcore-control update-agent-runtime --agent-runtime-id $runtimeId @umum @aws --query status `
            --output text | Out-Null
        Cek "update-agent-runtime"
    }
    for ($i = 0; ; $i++) {
        $status = (aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $runtimeId @aws --query status --output text).Trim()
        Cek "membaca status runtime"
        if ($status -eq "READY") { break }
        if ($status -like "*FAILED") {
            $alasan = aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $runtimeId @aws --query failureReason --output text
            throw "Runtime $status. $alasan"
        }
        if ($i -ge 60) { throw "Runtime belum READY setelah 5 menit (status $status)." }
        Start-Sleep -Seconds 5
    }
    $runtimeArn = (aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id $runtimeId @aws --query agentRuntimeArn --output text).Trim()
    Cek "membaca ARN runtime"
    Write-Host "   Runtime READY"

    Write-Host "6. Izinkan Lambda Copilot membangunkan runtime, lalu deploy ulang Copilot"
    $izinCopilot = Tulis-Json "izin-copilot.json" @{ Version = "2012-10-17"; Statement = @(@{
        Effect = "Allow"; Action = "bedrock-agentcore:InvokeAgentRuntime"; Resource = @($runtimeArn, "$runtimeArn/*") }) }
    $namaRoleLambda = $roleLambda.Split("/")[-1]
    aws iam put-role-policy --role-name $namaRoleLambda --policy-name rexa-bangunkan-agentcore `
        --policy-document $izinCopilot --profile $Profil
    Cek "memasang izin InvokeAgentRuntime"
    & (Join-Path $PSScriptRoot "deploy_copilot.ps1") -Profil $Profil -Region $Region -FungsiApi $FungsiApi `
        -Fungsi $FungsiCopilot -Agent $Nama

    Write-Host "7. Tandai Lambda API: agent sudah di Bedrock AgentCore"
    if ($envApi.CHIBIREX_AGENTCORE -ne "1") {
        $variabel = @{}
        $envApi.PSObject.Properties | ForEach-Object { $variabel[$_.Name] = $_.Value }
        $variabel.CHIBIREX_AGENTCORE = "1"
        aws lambda wait function-updated-v2 --function-name $FungsiApi @aws
        aws lambda update-function-configuration --function-name $FungsiApi @aws `
            --environment (Tulis-Json "env-api.json" @{ Variables = $variabel }) --query LastUpdateStatus --output text | Out-Null
        Cek "update-function-configuration Lambda API"
        aws lambda wait function-updated-v2 --function-name $FungsiApi @aws
        Cek "menunggu konfigurasi Lambda API"
    }

    Write-Host "8. Uji: Copilot membangunkan runtime, API harus mencatat bedrock-agentcore mengambil antrian"
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $copilotUrl = (aws lambda get-function-url-config --function-name $FungsiCopilot @aws --query FunctionUrl --output text).Trim().TrimEnd("/")
    Cek "membaca URL Copilot"
    $aktif = Invoke-RestMethod "$apiUrl/agent-runs/aktif" -TimeoutSec 30
    if ($aktif) {
        Write-Host "   Ada agent yang sedang $($aktif.status); uji dilewati supaya tidak mengganggu run itu."
    } else {
        for ($coba = 1; ; $coba++) {
            try {
                $mulai = Get-Date
                $r = Invoke-RestMethod "$copilotUrl/agent" -Method Post -Body '{"run_id": "uji-deploy"}' `
                    -ContentType "application/json" -TimeoutSec 90
                Write-Host "   Runtime menjawab '$($r.status)' dalam $([int]((Get-Date) - $mulai).TotalSeconds) dtk"
                break
            } catch {
                # Izin baru di IAM butuh beberapa detik sebelum berlaku.
                if ($coba -ge 4) { throw "Copilot gagal membangunkan runtime: $($_.Exception.Message). Lihat log: aws logs tail /aws/lambda/$FungsiCopilot --profile $Profil --region $Region" }
                Write-Host "   Belum siap ($($_.Exception.Message)); coba lagi ($coba/4)..."
                Start-Sleep -Seconds 10
            }
        }
        $terlihat = $false
        for ($i = 0; $i -lt 40 -and -not $terlihat; $i++) {
            $w = Invoke-RestMethod "$apiUrl/agent-runs/worker" -TimeoutSec 30
            $terlihat = ($w.nama -eq "bedrock-agentcore") -and $w.aktif
            if (-not $terlihat) { Start-Sleep -Milliseconds 1500 }
        }
        if ($terlihat) {
            Write-Host "   OK: runtime mengambil antrian API (alamat API dan token worker benar)."
        } else {
            Write-Warning ("API belum melihat bedrock-agentcore. Kalau worker laptop menyala, namanya bisa tertimpa; " +
                "selain itu lihat log: aws logs tail /aws/bedrock-agentcore/runtimes/$runtimeId-DEFAULT --since 10m --profile $Profil --region $Region")
        }
    }
    Write-Host "Selesai. Deploy ulang dashboard supaya tombol agent membangunkan AgentCore: powershell -ExecutionPolicy Bypass -File deploy\deploy_dashboard.ps1"
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
