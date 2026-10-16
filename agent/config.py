import os

from dotenv import load_dotenv

from engine.config import ROOT

ENV_FILE = ROOT / ".env"
load_dotenv(ENV_FILE)

# Model Amazon Nova (buatan Amazon, bukan lewat AWS Marketplace) bisa dipakai di paket gratis AWS.
# Kombinasi region + model ini dicoba `python -m agent.cek_bedrock` secara berurutan; yang pertama
# berhasil disimpan ke .env. Proyek AWS tim berada di Sydney, jadi Sydney dicoba lebih dulu.
# Kandidat terakhir memanggil model langsung di region (tanpa inference profile), sebagai cadangan
# kalau akun "pengalaman baru" memblokir fitur cross-region.
KANDIDAT_BEDROCK = [
    ("ap-southeast-2", "global.amazon.nova-2-lite-v1:0"),
    ("ap-southeast-2", "apac.amazon.nova-pro-v1:0"),
    ("us-east-1", "us.amazon.nova-2-lite-v1:0"),
    ("us-east-1", "amazon.nova-pro-v1:0"),
]

# Claude di Bedrock dijual lewat AWS Marketplace, jadi butuh Paid Plan.
# Dicoba dengan `python -m agent.cek_bedrock --claude` kalau suatu saat akun di-upgrade.
KANDIDAT_CLAUDE = [
    ("ap-southeast-2", "au.anthropic.claude-opus-5-5"),
    ("ap-southeast-2", "global.anthropic.claude-opus-5-5"),
    ("us-east-1", "global.anthropic.claude-opus-5-5"),
    ("us-east-1", "us.anthropic.claude-opus-5-5"),
]

BEDROCK_REGION = os.environ.get("CHIBIREX_BEDROCK_REGION", KANDIDAT_BEDROCK[0][0])
BEDROCK_MODEL_ID = os.environ.get("CHIBIREX_BEDROCK_MODEL_ID", KANDIDAT_BEDROCK[0][1])

# Alamat API Tahap 4 yang dipanggil tools agent.
API_URL = os.environ.get("CHIBIREX_API_URL", "http://127.0.0.1:8000")
