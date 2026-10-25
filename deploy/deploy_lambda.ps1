<#
Deploy ulang API Rexa ke AWS Lambda yang sudah ada. Function URL tidak berubah, jadi dashboard tidak perlu diubah.

Prasyarat:
  1. Docker Desktop menyala.
  2. Sudah login AWS CLI ke akun tim:  aws login --profile rexa
  3. data\processed\chibirex.duckdb ada (hasil: python -m engine.pipeline).

Jalankan dari mana saja di dalam repo:
  powershell -ExecutionPolicy Bypass -File deploy\deploy_lambda.ps1            # build, uji lokal, deploy
  powershell -ExecutionPolicy Bypass -File deploy\deploy_lambda.ps1 -UjiSaja   # build dan uji lokal saja
#>
param(
    [string]$Profil = "rexa",
    [string]$Region = "ap-southeast-2",
    [string]$Fungsi = "chibirex-api-function",
    [string]$Repo = "chibirex-api",
    [switch]$UjiSaja
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Cek([string]$Langkah) {
    if ($LASTEXITCODE -ne 0) { throw "Gagal: $Langkah" }
}

function Event-Lambda([string]$Path) {
    # Event Lambda Function URL (payload 2.0) untuk GET $Path dari dashboard Vercel.
    return (@{
        version = "2.0"; routeKey = '$default'; rawPath = $Path; rawQueryString = ""
        headers = @{ host = "uji.lokal"; origin = "https://chibirex-dashboard.vercel.app" }
        requestContext = @{
            http = @{ method = "GET"; path = $Path; protocol = "HTTP/1.1"; sourceIp = "127.0.0.1"; userAgent = "uji" }
            domainName = "uji.lokal"; stage = '$default'; requestId = "uji"; accountId = "anonymous"; apiId = "uji"
        }
        isBase64Encoded = $false
    } | ConvertTo-Json -Depth 5)
}

if (-not (Test-Path "data\processed\chibirex.duckdb")) {
    throw "data\processed\chibirex.duckdb belum ada. Jalankan dulu: python -m engine.pipeline"
}
docker info *> $null; Cek "Docker Desktop belum menyala"

$tag = "{0}-{1}" -f (git rev-parse --short HEAD), (Get-Date -Format "yyyyMMdd-HHmm")
$lokal = "rexa-api:$tag"

Write-Host "1. Build image $lokal"
docker build --platform linux/amd64 --provenance=false -t $lokal .; Cek "docker build"

Write-Host "2. Uji image di laptop (filesystem hanya-baca kecuali /tmp, seperti di Lambda)"
$kontainer = docker run -d --rm -p 9000:8080 --read-only --tmpfs /tmp -e AWS_LAMBDA_FUNCTION_NAME=uji-lokal $lokal
Cek "docker run"
try {
    Start-Sleep -Seconds 3
    foreach ($path in "/health", "/stores/74/ringkasan") {
        $hasil = Invoke-RestMethod -Method Post -Uri "http://localhost:9000/2015-03-31/functions/function/invocations" `
            -Body (Event-Lambda $path) -ContentType "application/json"
        if ($hasil.statusCode -ne 200) { throw "Uji $path gagal: $($hasil | ConvertTo-Json -Depth 5)" }
        Write-Host "   $path -> 200"
    }
    if ($hasil.headers.'access-control-allow-origin' -ne "https://chibirex-dashboard.vercel.app") {
        throw "CORS untuk dashboard Vercel tidak aktif"
    }
    Write-Host "   CORS dashboard Vercel -> OK"
} finally {
    docker stop $kontainer *> $null
}
if ($UjiSaja) { Write-Host "Selesai (-UjiSaja): image tidak dikirim ke AWS."; exit 0 }

Write-Host "3. Kirim image ke Amazon ECR"
$akun = aws sts get-caller-identity --profile $Profil --query Account --output text
Cek "login AWS CLI. Jalankan dulu: aws login --profile $Profil"
$registry = "$akun.dkr.ecr.$Region.amazonaws.com"
$image = "$registry/${Repo}:$tag"
docker tag $lokal $image; Cek "docker tag"
# Token ECR terlalu panjang untuk Windows Credential Manager ("The stub received bad data"), padahal Docker
# memakainya otomatis selama docker-credential-wincred/desktop ada di PATH. Jadi selama login dan push, folder
# itu dikeluarkan dari PATH dan token disimpan di folder konfigurasi Docker sementara yang dihapus setelahnya.
# DOCKER_HOST dipertahankan supaya perintah tetap mengarah ke Docker Desktop.
$docker = (Get-Command docker).Source
$env:DOCKER_HOST = (& $docker context inspect --format "{{.Endpoints.docker.Host}}"); Cek "membaca context Docker"
$konfigSementara = Join-Path $env:TEMP "rexa-docker-ecr"
New-Item -ItemType Directory -Force $konfigSementara | Out-Null
Set-Content -Path (Join-Path $konfigSementara "config.json") -Value "{}" -Encoding Ascii
$pathAsli = $env:Path
$env:DOCKER_CONFIG = $konfigSementara
$env:Path = ($pathAsli -split ";" | Where-Object {
    $_ -and -not (Test-Path (Join-Path $_ "docker-credential-wincred.exe")) -and
    -not (Test-Path (Join-Path $_ "docker-credential-desktop.exe"))
}) -join ";"
try {
    # Pipe lewat cmd: pipe PowerShell 5.1 antar program native mengubah token ECR yang panjang (login 400 Bad Request).
    cmd /c "aws ecr get-login-password --profile $Profil --region $Region | `"$docker`" login --username AWS --password-stdin $registry"
    Cek "docker login ke ECR"
    & $docker push $image; Cek "docker push"
} finally {
    $env:Path = $pathAsli
    Remove-Item Env:DOCKER_CONFIG
    Remove-Item -Recurse -Force $konfigSementara
}

Write-Host "4. Perbarui Lambda $Fungsi"
aws lambda update-function-code --function-name $Fungsi --image-uri $image --profile $Profil --region $Region `
    --query "LastUpdateStatus" --output text
Cek "update-function-code"
aws lambda wait function-updated-v2 --function-name $Fungsi --profile $Profil --region $Region
Cek "menunggu Lambda selesai diperbarui"
$url = aws lambda get-function-url-config --function-name $Fungsi --profile $Profil --region $Region `
    --query FunctionUrl --output text
Write-Host "Selesai. Cek: ${url}health"
