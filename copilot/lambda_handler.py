"""Handler Lambda `rexa-copilot` (Function URL, payload 2.0). CORS diatur di konfigurasi Function URL.

POST /tanya     {"store": 74, "pertanyaan": "...", "riwayat": [{"peran": "user"|"assistant", "teks": "..."}]}
POST /jaringan  {"bahasa": "id"|"en"}: agent jaringan (copilot/jaringan.py) menganalisis semua toko.
POST /agent     {"run_id": "..."}: bangunkan agent toko di Bedrock AgentCore (copilot/agentcore.py) untuk tugas yang
                baru masuk antrian API.
GET  /          cek kesehatan dan model yang dipakai.
Galat memakai format yang sama dengan API Rexa: {"detail": {"kode": ..., "pesan": ...}}.
"""

import base64
import json
import re

from copilot import agentcore, jaringan
from copilot.inti import MODEL_ID, jawab


def _json(status: int, isi: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"},
            "body": json.dumps(isi, ensure_ascii=False, default=str)}


def _galat(status: int, kode: str, pesan: str) -> dict:
    return _json(status, {"detail": {"kode": kode, "pesan": pesan}})


def _body(event: dict) -> dict:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode()
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("Body harus objek JSON.")
    return data


def _baca_permintaan(event: dict) -> tuple[int, str, list]:
    data = _body(event)
    store, pertanyaan, riwayat = data.get("store"), data.get("pertanyaan"), data.get("riwayat") or []
    if not isinstance(store, int) or not 1 <= store <= 9999:
        raise ValueError("store harus nomor toko.")
    if not isinstance(pertanyaan, str) or not 1 <= len(pertanyaan.strip()) <= 1000:
        raise ValueError("pertanyaan harus 1-1000 karakter.")
    if not isinstance(riwayat, list) or len(riwayat) > 20 or not all(
            isinstance(r, dict) and isinstance(r.get("teks"), str) and len(r["teks"]) <= 4000 for r in riwayat):
        raise ValueError("riwayat harus daftar {peran, teks} (paling banyak 20 pesan).")
    return store, pertanyaan.strip(), riwayat


def _analisis_jaringan(event: dict) -> dict:
    try:
        bahasa = _body(event).get("bahasa", "id")
    except ValueError as e:  # termasuk JSONDecodeError
        return _galat(422, "PERMINTAAN_TIDAK_VALID", str(e))
    if bahasa not in jaringan.BAHASA:
        return _galat(422, "PERMINTAAN_TIDAK_VALID", "bahasa harus id atau en.")
    try:
        return _json(200, jaringan.analisis(bahasa))
    except Exception as e:
        print(f"JARINGAN_GAGAL: {type(e).__name__}: {e}")
        return _galat(502, "JARINGAN_GAGAL", "Agent jaringan belum bisa berjalan sekarang. Coba lagi sebentar.")


def _bangunkan_agent(event: dict) -> dict:
    try:
        run_id = _body(event).get("run_id")
    except ValueError as e:
        return _galat(422, "PERMINTAAN_TIDAK_VALID", str(e))
    if run_id is not None and not (isinstance(run_id, str) and re.fullmatch(r"[0-9a-zA-Z_-]{1,64}", run_id)):
        return _galat(422, "PERMINTAAN_TIDAK_VALID", "run_id tidak valid.")
    try:
        return _json(202, agentcore.bangunkan(run_id))
    except agentcore.AgentCoreBelumAda:
        return _galat(503, "AGENTCORE_BELUM_ADA", "Agent belum di-deploy ke Bedrock AgentCore; tugas menunggu worker "
                                                  "di laptop.")
    except Exception as e:
        print(f"AGENTCORE_GAGAL run={run_id}: {type(e).__name__}: {e}")
        return _galat(502, "AGENTCORE_GAGAL", "Agent di Bedrock AgentCore belum bisa dibangunkan.")


def handler(event, context):
    http = (event.get("requestContext") or {}).get("http") or {}
    metode, path = http.get("method", "POST"), (event.get("rawPath") or "/").rstrip("/")
    if metode == "GET":
        return _json(200, {"status": "ok", "model": MODEL_ID, "model_jaringan": jaringan.MODEL_ID,
                           "agentcore": bool(agentcore.RUNTIME_ARN)})
    if metode == "POST" and path == "/jaringan":
        return _analisis_jaringan(event)
    if metode == "POST" and path == "/agent":
        return _bangunkan_agent(event)
    if metode != "POST" or path not in ("", "/tanya"):
        return _galat(404, "TIDAK_ADA", "Pakai POST /tanya, POST /jaringan, atau POST /agent.")
    try:
        store, pertanyaan, riwayat = _baca_permintaan(event)
    except (ValueError, json.JSONDecodeError) as e:
        return _galat(422, "PERMINTAAN_TIDAK_VALID", str(e))
    try:
        return _json(200, jawab(pertanyaan, store, riwayat))
    except Exception as e:  # Bedrock atau API Rexa sedang bermasalah; detailnya ke CloudWatch, bukan ke pengguna
        print(f"COPILOT_GAGAL store={store}: {type(e).__name__}: {e}")
        return _galat(502, "COPILOT_GAGAL", "Copilot belum bisa menjawab sekarang. Coba lagi sebentar.")
