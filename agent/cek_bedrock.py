"""Cek kesiapan Amazon Bedrock untuk Tahap 5: `python -m agent.cek_bedrock`.

Memeriksa kredensial AWS (dari `aws login`), lalu mencoba kombinasi region + inference profile
Claude Opus 5.5 secara berurutan dengan satu panggilan Converse kecil. Kombinasi pertama yang
berhasil disimpan ke .env, sehingga agent otomatis memakainya.
"""

import os
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import set_key

from agent.config import ENV_FILE, KANDIDAT_BEDROCK


def coba_converse(region: str, model_id: str) -> str:
    runtime = boto3.client("bedrock-runtime", region_name=region)
    resp = runtime.converse(
        modelId=model_id,
        messages=[{"role": "user", "content": [{"text": "Balas dengan satu kalimat: Bedrock siap dipakai."}]}],
        inferenceConfig={"maxTokens": 1024},
    )
    teks = " ".join(c["text"] for c in resp["output"]["message"]["content"] if "text" in c)
    u = resp["usage"]
    return f"{teks.strip()} ({u['inputTokens']} token input, {u['outputTokens']} token output)"


def main() -> None:
    try:
        identitas = boto3.client("sts", region_name=KANDIDAT_BEDROCK[0][0]).get_caller_identity()
    except (BotoCoreError, ClientError) as e:
        print(f"[GAGAL] Kredensial AWS tidak bisa dipakai: {e}\n"
              "Jalankan `aws login` lalu pilih proyek kalian di browser (langkah 5 di progress.md). "
              "Kredensial berlaku 12 jam; kalau sudah lewat, jalankan `aws login` lagi.")
        sys.exit(1)
    print(f"[ok] Kredensial AWS: {identitas['Arn']}\n")

    kandidat = KANDIDAT_BEDROCK
    if os.environ.get("CHIBIREX_BEDROCK_REGION") and os.environ.get("CHIBIREX_BEDROCK_MODEL_ID"):
        kandidat = [(os.environ["CHIBIREX_BEDROCK_REGION"], os.environ["CHIBIREX_BEDROCK_MODEL_ID"])] + [
            k for k in KANDIDAT_BEDROCK
            if k != (os.environ["CHIBIREX_BEDROCK_REGION"], os.environ["CHIBIREX_BEDROCK_MODEL_ID"])]

    for region, model_id in kandidat:
        print(f"Mencoba {model_id} di {region} ...")
        try:
            jawaban = coba_converse(region, model_id)
        except ClientError as e:
            print(f"  [x] {e.response['Error']['Code']}: {e.response['Error']['Message']}")
            continue
        except BotoCoreError as e:
            print(f"  [x] {e}")
            continue
        print(f"  [ok] Claude menjawab: {jawaban}")
        set_key(str(ENV_FILE), "CHIBIREX_BEDROCK_REGION", region)
        set_key(str(ENV_FILE), "CHIBIREX_BEDROCK_MODEL_ID", model_id)
        print(f"\nTersimpan di {ENV_FILE.name}: region {region}, model {model_id}.")
        print("Semua cek lulus. Bedrock siap untuk Tahap 5.")
        return

    print("\n[GAGAL] Tidak ada kombinasi yang berhasil. Penyebab yang umum:\n"
          "  - AccessDeniedException 'don't have access to the model': formulir use case Anthropic belum diisi "
          "di konsol Bedrock (langkah 3).\n"
          "  - AccessDeniedException yang menyebut 'service control policy': akun proyek membatasi fitur "
          "cross-region; kirim pesan error di atas supaya bisa dicarikan jalan lain.\n"
          "  - ValidationException 'model identifier is invalid': model belum tersedia di region tersebut.")
    sys.exit(1)


if __name__ == "__main__":
    main()
