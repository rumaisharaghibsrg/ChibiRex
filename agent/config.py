import os

from dotenv import load_dotenv

from engine.config import ROOT

ENV_FILE = ROOT / ".env"
load_dotenv(ENV_FILE)

# Penyedia model untuk agent: "ollama" (LLM lokal, default) atau "bedrock" (opsional, untuk build final di AWS).
# Kode agent sama untuk keduanya; cukup ganti CHIBIREX_LLM_PROVIDER di .env.
LLM_PROVIDER = os.environ.get("CHIBIREX_LLM_PROVIDER", "ollama")

# Qwen3 14B (±9 GB) muat di VRAM 12 GB. Untuk laptop dengan GPU lebih kecil, pakai qwen3:8b (±5 GB).
OLLAMA_HOST = os.environ.get("CHIBIREX_OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("CHIBIREX_OLLAMA_MODEL", "qwen3:14b")
# Uji di RTX 5070 Ti (VRAM 12 GB): konteks 8K membuat model 100% di GPU (±12 dtk per pertanyaan + 1 tool);
# 12K-16K tumpah ke CPU dan 2-4x lebih lambat. Kalau butuh konteks lebih besar, aktifkan kompresi KV cache
# Ollama (OLLAMA_KV_CACHE_TYPE=q8_0) lalu naikkan nilai ini.
OLLAMA_NUM_CTX = int(os.environ.get("CHIBIREX_OLLAMA_NUM_CTX", "8192"))
# Thinking dimatikan (4-5x lebih cepat). Qwen3 tidak andal membandingkan angka sendiri, dengan atau tanpa
# thinking (stok 43 vs reorder point 83: 0/5 benar kalau tool hanya memberi angka mentah). Kalau tool memberi
# keputusan jadi (perlu_reorder, status_stok) dan prompt melarang menghitung, hasilnya 5/5 benar di kedua mode.
OLLAMA_THINK = os.environ.get("CHIBIREX_OLLAMA_THINK", "false").lower() == "true"

# ---- Bedrock (opsional) ----
# Model Amazon Nova bisa dipakai di paket gratis AWS; Claude butuh Paid Plan karena dijual lewat Marketplace.
# Kombinasi ini dicoba `python -m agent.cek_bedrock` (atau `--claude`); yang berhasil disimpan ke .env.
KANDIDAT_BEDROCK = [
    ("ap-southeast-2", "global.amazon.nova-2-lite-v1:0"),
    ("ap-southeast-2", "apac.amazon.nova-pro-v1:0"),
    ("us-east-1", "us.amazon.nova-2-lite-v1:0"),
    ("us-east-1", "amazon.nova-pro-v1:0"),
]
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
