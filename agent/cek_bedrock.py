"""Cek kesiapan Amazon Bedrock untuk Tahap 5: `python -m agent.cek_bedrock` (tambahkan `--claude` untuk Claude).

Memeriksa kredensial AWS (dari `aws login`), lalu mencoba kombinasi region + model secara berurutan
dengan satu panggilan Converse kecil. Kombinasi pertama yang berhasil disimpan ke .env, sehingga
agent otomatis memakainya.
"""

import os
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import set_key

from agent.config import ENV_FILE, KANDIDAT_BEDROCK, KANDIDAT_CLAUDE


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
    kandidat = KANDIDAT_CLAUDE if "--claude" in sys.argv else KANDIDAT_BEDROCK
    if os.environ.get("AWS_BEARER_TOKEN_BEDROCK"):
        # API key Bedrock di .env: boto3 memakainya untuk bedrock-runtime, tanpa perlu `aws login`.
        print("[ok] Kredensial: API key Bedrock (AWS_BEARER_TOKEN_BEDROCK di .env)\n")
    else:
        try:
            identitas = boto3.client("sts", region_name=kandidat[0][0]).get_caller_identity()
        except (BotoCoreError, ClientError) as e:
            print(f"[GAGAL] Kredensial AWS tidak bisa dipakai: {e}\n"
                  "Isi AWS_BEARER_TOKEN_BEDROCK (API key Bedrock) di .env, atau jalankan `aws login` lalu pilih "
                  "proyek kalian di browser. Kredensial `aws login` berlaku 12 jam.")
            sys.exit(1)
        print(f"[ok] Kredensial AWS: {identitas['Arn']}\n")

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
        print(f"  [ok] Model menjawab: {jawaban}")
        set_key(str(ENV_FILE), "CHIBIREX_BEDROCK_REGION", region)
        set_key(str(ENV_FILE), "CHIBIREX_BEDROCK_MODEL_ID", model_id)
        print(f"\nTersimpan di {ENV_FILE.name}: region {region}, model {model_id}.")
        print("Semua cek lulus. Bedrock siap untuk Tahap 5.")
        return

    print("\n[GAGAL] Tidak ada kombinasi yang berhasil. Penyebab yang umum:\n"
          "  - AccessDeniedException 'account is currently being verified': akun AWS masih diverifikasi "
          "(biasanya < 2 jam). Cek email dari AWS (termasuk folder spam); kalau lebih dari 2 jam, kirim email "
          "ke aws-verification@amazon.com. Setelah terverifikasi, jalankan skrip ini lagi.\n"
          "  - AccessDeniedException yang menyebut 'service control policy': akun proyek membatasi fitur "
          "tersebut (misalnya cross-region).\n"
          "  - Pesan soal Marketplace, subscription, atau paket gratis: model pihak ketiga seperti Claude "
          "butuh Paid Plan.\n"
          "  - ValidationException 'model identifier is invalid': model belum tersedia di region tersebut.\n"
          "Kirim seluruh pesan di atas supaya bisa dicarikan jalan lain.")
    sys.exit(1)


if __name__ == "__main__":
    main()
