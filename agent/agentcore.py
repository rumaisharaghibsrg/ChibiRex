"""Agent Rexa di Amazon Bedrock AgentCore Runtime, supaya agent tetap berjalan walaupun laptop mati.

Alurnya sama dengan worker di laptop (agent/worker.py); yang berbeda hanya pemicunya. Tombol "Jalankan agent"
menaruh tugas di antrian API, lalu dashboard meminta Lambda Copilot (`POST /agent`, copilot/agentcore.py) memanggil
runtime ini. Runtime langsung menjawab, lalu di latar mengambil tugas dari antrian, menjalankan agent Strands dengan
Claude di Bedrock (izin dari role runtime, tanpa API key), dan melaporkan setiap langkah ke API. Selama agent
bekerja, /ping menjawab HealthyBusy supaya sesinya tidak dihentikan karena dianggap menganggur.

Di-deploy oleh deploy\\deploy_agent.ps1 sebagai kode Python (entryPoint agent/agentcore.py), tanpa container.
Uji lokal: python -m agent.agentcore (port 8080), lalu POST http://127.0.0.1:8080/invocations dengan body {}.
"""

import sys
import threading
from pathlib import Path

# AgentCore menjalankan file ini langsung (python agent/agentcore.py): paket agent/ dan dependensi ada di akar zip.
if __package__ in (None, ""):
    sys.path[0] = str(Path(__file__).resolve().parent.parent)

import httpx  # noqa: E402
from bedrock_agentcore.runtime import BedrockAgentCoreApp  # noqa: E402

from agent import config  # noqa: E402
from agent.worker import kerjakan_satu  # noqa: E402

NAMA = "bedrock-agentcore"  # tercatat di GET /agent-runs/worker sebagai pengambil tugas terakhir

app = BedrockAgentCoreApp()


def _kerjakan(task_id: int, run_id: str | None) -> None:
    try:
        with httpx.Client(base_url=config.WORKER_API_URL, timeout=60, headers=config.header_worker()) as client:
            if not kerjakan_satu(client, NAMA):
                print(f"Antrian kosong (run {run_id} sudah diambil worker lain atau sudah ditutup API).")
    except (Exception, SystemExit) as e:  # SystemExit: token worker ditolak API
        print(f"AGENT_GAGAL run={run_id}: {type(e).__name__}: {e}")
    finally:
        app.complete_async_task(task_id)


@app.entrypoint
def mulai(payload: dict) -> dict:
    """Payload {"run_id": ...} hanya untuk log; tugas yang dikerjakan selalu yang tertua di antrian API."""
    run_id = payload.get("run_id") if isinstance(payload, dict) else None
    task_id = app.add_async_task("agent_toko", {"run_id": run_id})
    threading.Thread(target=_kerjakan, args=(task_id, run_id), daemon=True).start()
    return {"status": "diterima", "run_id": run_id}


if __name__ == "__main__":
    app.run()
