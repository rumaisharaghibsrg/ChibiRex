<#
Deploy Rexa Copilot (chatbot dashboard dan agent jaringan halaman "Semua Toko") ke AWS Lambda `rexa-copilot`
dengan Function URL publik.

Lambda ini sengaja di luar VPC: Lambda API (chibirex-api-function) berada di VPC tanpa akses internet keluar, jadi
tidak bisa memanggil Bedrock. Copilot membaca data lewat Function URL API (hanya GET) dan bertanya ke Claude di
Bedrock dengan izin role Lambda (role yang sama dengan Lambda API), tanpa API key. Kode: folder copilot/.

Prasyarat: .venv repo (untuk membuat zip) dan login AWS CLI:  aws login --profile rexa
  powershell -ExecutionPolicy Bypass -File deploy\deploy_copilot.ps1
Setelah itu deploy ulang dashboard (deploy\deploy_dashboard.ps1) supaya chatbot memakai URL Copilot ini.
#>
param(
    [string]$Profil = "rexa",
    [string]$Region = "ap-southeast-2",
    [string]$Fungsi = "rexa-copilot",
    [string]$FungsiApi = "chibirex-api-function",
    [string]$App = "rexa-dashboard",
    [string]$Model = "au.anthropic.claude-haiku-4-5-20251001-v1:0",
    [string]$ModelJaringan = "au.anthropic.claude-sonnet-4-6"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Cek([string]$Langkah) {
    if ($LASTEXITCODE -ne 0) { throw "Gagal: $Langkah" }
}

$aws = @("--profile", $Profil, "--region", $Region)
$tmp = Join-Path $env:TEMP "rexa-copilot"
New-Item -ItemType Directory -Force $tmp | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Argumen JSON untuk AWS CLI ditulis ke file, karena tanda kutip di baris perintah PowerShell 5.1 mudah rusak.
function Tulis-Json([string]$Nama, $Isi) {
    $path = Join-Path $tmp $Nama
    [IO.File]::WriteAllText($path, ($Isi | ConvertTo-Json -Depth 5 -Compress), $utf8)
    return "file://" + $path.Replace("\", "/")
}

Write-Host "1. Baca alamat API, role, dan domain dashboard"
$apiUrl = (aws lambda get-function-url-config --function-name $FungsiApi @aws --query FunctionUrl --output text)
Cek "membaca URL Lambda API. Jalankan dulu: aws login --profile $Profil"
$apiUrl = $apiUrl.Trim().TrimEnd("/")
$role = (aws lambda get-function-configuration --function-name $FungsiApi @aws --query Role --output text).Trim()
Cek "membaca role Lambda API"
$appId = (aws amplify list-apps @aws --query "apps[?name=='$App'].appId | [0]" --output text).Trim()
Cek "mencari aplikasi Amplify $App"
$domain = (aws amplify get-app --app-id $appId @aws --query "app.defaultDomain" --output text).Trim()
Cek "membaca domain Amplify"
# Dashboard (Amplify dan Vite lokal) dan Virtual HQ lokal (Vite 8080).
$origins = @("https://main.$domain", "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8080", "http://127.0.0.1:8080")

Write-Host "2. Kemas kode copilot/ ke zip (tanpa dependensi: boto3 sudah ada di runtime Lambda)"
$zip = Join-Path $tmp "copilot.zip"
& .venv\Scripts\python.exe -I -c @"
import pathlib, sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as z:
    for f in pathlib.Path('copilot').rglob('*.py'):
        z.write(f, f.as_posix())
"@ $zip
Cek "membuat zip"

$lingkungan = Tulis-Json "env.json" @{ Variables = @{ REXA_API_URL = $apiUrl; COPILOT_MODEL_ID = $Model; COPILOT_REGION = $Region; JARINGAN_MODEL_ID = $ModelJaringan } }
$cors = Tulis-Json "cors.json" @{ AllowOrigins = $origins; AllowMethods = @("GET", "POST"); AllowHeaders = @("content-type"); MaxAge = 600 }

$ErrorActionPreference = "Continue"  # di PowerShell 5.1, stderr perintah native memicu galat kalau "Stop"
aws lambda get-function --function-name $Fungsi @aws --query "Configuration.FunctionName" --output text 2>$null | Out-Null
$ada = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"

if (-not $ada) {
    Write-Host "3. Buat Lambda $Fungsi (di luar VPC, role sama dengan Lambda API)"
    aws lambda create-function --function-name $Fungsi --runtime python3.12 --architectures arm64 `
        --handler copilot.lambda_handler.handler --role $role --zip-file "fileb://$zip" --timeout 120 --memory-size 512 `
        --environment $lingkungan --description "Rexa Copilot: chatbot dashboard, Claude di Bedrock, hanya membaca API" `
        @aws --query FunctionArn --output text | Out-Null
    Cek "create-function"
    aws lambda wait function-active-v2 --function-name $Fungsi @aws
    Cek "menunggu Lambda aktif"
    aws lambda create-function-url-config --function-name $Fungsi --auth-type NONE --cors $cors @aws `
        --query FunctionUrl --output text | Out-Null
    Cek "create-function-url-config"
    # Izin publik untuk Function URL, sama seperti Lambda API.
    aws lambda add-permission --function-name $Fungsi --statement-id url-publik --action lambda:InvokeFunctionUrl `
        --principal "*" --function-url-auth-type NONE @aws | Out-Null
    Cek "izin InvokeFunctionUrl"
    aws lambda add-permission --function-name $Fungsi --statement-id url-publik-invoke --action lambda:InvokeFunction `
        --principal "*" --invoked-via-function-url @aws | Out-Null
    Cek "izin InvokeFunction lewat Function URL"
} else {
    Write-Host "3. Perbarui Lambda $Fungsi"
    aws lambda update-function-code --function-name $Fungsi --zip-file "fileb://$zip" @aws --query LastUpdateStatus `
        --output text | Out-Null
    Cek "update-function-code"
    aws lambda wait function-updated-v2 --function-name $Fungsi @aws
    Cek "menunggu kode baru"
    aws lambda update-function-configuration --function-name $Fungsi --environment $lingkungan --timeout 120 `
        --memory-size 512 @aws --query LastUpdateStatus --output text | Out-Null
    Cek "update-function-configuration"
    aws lambda wait function-updated-v2 --function-name $Fungsi @aws
    Cek "menunggu konfigurasi baru"
    aws lambda update-function-url-config --function-name $Fungsi --cors $cors @aws --query FunctionUrl `
        --output text | Out-Null
    Cek "update-function-url-config"
}

$url = (aws lambda get-function-url-config --function-name $Fungsi @aws --query FunctionUrl --output text).Trim().TrimEnd("/")
Cek "membaca URL Copilot"

Write-Host "4. Uji Copilot"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$tanya = [Text.Encoding]::UTF8.GetBytes((@{ store = 74; pertanyaan = "Berapa Health Score toko ini? Jawab satu kalimat." } | ConvertTo-Json))
for ($coba = 1; ; $coba++) {
    try {
        $r = Invoke-RestMethod "$url/tanya" -Method Post -Body $tanya -ContentType "application/json; charset=utf-8" -TimeoutSec 90
        Write-Host "   Jawaban: $($r.jawaban)"
        break
    } catch {
        # Izin URL baru butuh beberapa detik sebelum berlaku.
        if ($coba -ge 4) { throw "Uji Copilot gagal: $($_.Exception.Message). Lihat log: aws logs tail /aws/lambda/$Fungsi --profile $Profil --region $Region" }
        Write-Host "   Belum siap ($($_.Exception.Message)); coba lagi ($coba/4)..."
        Start-Sleep -Seconds 8
    }
}
Write-Host "Selesai. Deploy ulang dashboard supaya chatbot memakai Copilot: powershell -ExecutionPolicy Bypass -File deploy\deploy_dashboard.ps1"
