<#
Deploy dashboard React ke AWS Amplify (aplikasi rexa-dashboard, cabang main) tanpa sambungan GitHub.
Alamat API diambil otomatis dari Function URL Lambda, jadi dashboard selalu mengarah ke API yang benar.

Prasyarat: Node.js, .venv repo (untuk membuat zip), dan login AWS CLI:  aws login --profile rexa
Jalankan dari mana saja di dalam repo:
  powershell -ExecutionPolicy Bypass -File deploy\deploy_dashboard.ps1
#>
param(
    [string]$Profil = "rexa",
    [string]$Region = "ap-southeast-2",
    [string]$App = "rexa-dashboard",
    [string]$Cabang = "main",
    [string]$Fungsi = "chibirex-api-function"
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Cek([string]$Langkah) {
    if ($LASTEXITCODE -ne 0) { throw "Gagal: $Langkah" }
}

$apiUrl = (aws lambda get-function-url-config --function-name $Fungsi --profile $Profil --region $Region `
    --query FunctionUrl --output text)
Cek "membaca URL Lambda. Jalankan dulu: aws login --profile $Profil"
$apiUrl = $apiUrl.Trim().TrimEnd("/")
$appId = (aws amplify list-apps --profile $Profil --region $Region --query "apps[?name=='$App'].appId | [0]" --output text).Trim()
Cek "mencari aplikasi Amplify $App"
$domain = (aws amplify get-app --app-id $appId --profile $Profil --region $Region --query "app.defaultDomain" --output text).Trim()

Write-Host "1. Build dashboard (VITE_API_URL=$apiUrl)"
Push-Location dashboard
try {
    npm ci --no-audit --no-fund; Cek "npm ci"
    $env:VITE_API_URL = $apiUrl
    npm run build; Cek "npm run build"
} finally {
    Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Host "2. Kemas dist ke zip"
# Compress-Archive di PowerShell 5.1 menulis path dengan '\', yang membuat Amplify gagal menyajikan folder assets.
$zip = Join-Path $env:TEMP "rexa-dashboard.zip"
& .venv\Scripts\python.exe -I -c @"
import pathlib, sys, zipfile
dist = pathlib.Path('dashboard/dist')
with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as z:
    for f in dist.rglob('*'):
        if f.is_file():
            z.write(f, f.relative_to(dist).as_posix())
"@ $zip
Cek "membuat zip"

Write-Host "3. Upload ke Amplify ($App/$Cabang)"
$dep = aws amplify create-deployment --app-id $appId --branch-name $Cabang --profile $Profil --region $Region `
    --output json | ConvertFrom-Json
Cek "create-deployment"
Invoke-WebRequest -Uri $dep.zipUploadUrl -Method Put -InFile $zip -ContentType "application/zip" -UseBasicParsing | Out-Null
aws amplify start-deployment --app-id $appId --branch-name $Cabang --job-id $dep.jobId --profile $Profil `
    --region $Region --query "jobSummary.status" --output text
Cek "start-deployment"

do {
    Start-Sleep -Seconds 3
    $status = (aws amplify get-job --app-id $appId --branch-name $Cabang --job-id $dep.jobId --profile $Profil `
        --region $Region --query "job.summary.status" --output text).Trim()
} while ($status -in @("PENDING", "PROVISIONING", "RUNNING"))
Remove-Item $zip -ErrorAction SilentlyContinue
if ($status -ne "SUCCEED") { throw "Deploy Amplify berstatus $status" }
Write-Host "Selesai: https://$Cabang.$domain"
