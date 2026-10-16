import os

from dotenv import load_dotenv

from engine.config import ROOT

ENV_FILE = ROOT / ".env"
load_dotenv(ENV_FILE)

# Kombinasi region + inference profile Claude Opus 5.5 yang dicoba `python -m agent.cek_bedrock`, berurutan.
# Akun "pengalaman baru" AWS dari Indonesia berada di Asia Pacific (Sydney), jadi Sydney dicoba lebih dulu.
# Hasil yang berhasil disimpan ke .env sebagai CHIBIREX_BEDROCK_REGION dan CHIBIREX_BEDROCK_MODEL_ID.
KANDIDAT_BEDROCK = [
    ("ap-southeast-2", "au.anthropic.claude-opus-5-5"),
    ("ap-southeast-2", "global.anthropic.claude-opus-5-5"),
    ("us-east-1", "global.anthropic.claude-opus-5-5"),
    ("us-east-1", "us.anthropic.claude-opus-5-5"),
]

BEDROCK_REGION = os.environ.get("CHIBIREX_BEDROCK_REGION", KANDIDAT_BEDROCK[0][0])
BEDROCK_MODEL_ID = os.environ.get("CHIBIREX_BEDROCK_MODEL_ID", KANDIDAT_BEDROCK[0][1])

# Alamat API Tahap 4 yang dipanggil tools agent.
API_URL = os.environ.get("CHIBIREX_API_URL", "http://127.0.0.1:8000")
