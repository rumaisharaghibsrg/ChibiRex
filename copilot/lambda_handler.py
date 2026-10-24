"""Handler Lambda `rexa-copilot` (Function URL, payload 2.0). CORS diatur di konfigurasi Function URL.

POST /tanya  {"store": 74, "pertanyaan": "...", "riwayat": [{"peran": "user"|"assistant", "teks": "..."}]}
GET  /       cek kesehatan dan model yang dipakai.
Galat memakai format yang sama dengan API Rexa: {"detail": {"kode": ..., "pesan": ...}}.
"""

import base64
import json

from copilot.inti import MODEL_ID, jawab


def _json(status: int, isi: dict) -> dict:
    return {"statusCode": status, "headers": {"Content-Type": "application/json"},
            "body": json.dumps(isi, ensure_ascii=False, default=str)}


def _galat(status: int, kode: str, pesan: str) -> dict:
    return _json(status, {"detail": {"kode": kode, "pesan": pesan}})


def _baca_permintaan(event: dict) -> tuple[int, str, list]:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode()
    data = json.loads(body)
    store, pertanyaan, riwayat = data.get("store"), data.get("pertanyaan"), data.get("riwayat") or []
    if not isinstance(store, int) or not 1 <= store <= 9999:
        raise ValueError("store harus nomor toko.")
    if not isinstance(pertanyaan, str) or not 1 <= len(pertanyaan.strip()) <= 1000:
        raise ValueError("pertanyaan harus 1-1000 karakter.")
    if not isinstance(riwayat, list) or len(riwayat) > 20 or not all(
            isinstance(r, dict) and isinstance(r.get("teks"), str) and len(r["teks"]) <= 4000 for r in riwayat):
        raise ValueError("riwayat harus daftar {peran, teks} (paling banyak 20 pesan).")
    return store, pertanyaan.strip(), riwayat


def handler(event, context):
    http = (event.get("requestContext") or {}).get("http") or {}
    metode, path = http.get("method", "POST"), (event.get("rawPath") or "/").rstrip("/")
    if metode == "GET":
        return _json(200, {"status": "ok", "model": MODEL_ID})
    if metode != "POST" or path not in ("", "/tanya"):
        return _galat(404, "TIDAK_ADA", "Pakai POST /tanya.")
    try:
        store, pertanyaan, riwayat = _baca_permintaan(event)
    except (ValueError, json.JSONDecodeError) as e:
        return _galat(422, "PERMINTAAN_TIDAK_VALID", str(e))
    try:
        return _json(200, jawab(pertanyaan, store, riwayat))
    except Exception as e:  # Bedrock atau API Rexa sedang bermasalah; detailnya ke CloudWatch, bukan ke pengguna
        print(f"COPILOT_GAGAL store={store}: {type(e).__name__}: {e}")
        return _galat(502, "COPILOT_GAGAL", "Copilot belum bisa menjawab sekarang. Coba lagi sebentar.")
