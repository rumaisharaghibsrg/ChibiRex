"""Jalankan agent: `python -m agent.run --store 74` (API Tahap 4 harus sudah berjalan)."""

import argparse
import time
from uuid import uuid4

import httpx
from strands import Agent

from agent import config
from agent.llm import buat_model, nama_model
from agent.prompt import SYSTEM_PROMPT
from agent.tools import AlatAgent


def _token(hasil) -> tuple[int, int, int]:
    """Total token input/output, dan input terbesar dalam satu panggilan model (untuk memantau batas konteks)."""
    m = hasil.metrics
    total = m.accumulated_usage
    siklus = m.agent_invocations[-1].cycles if m.agent_invocations else []
    terbesar = max((c.usage.get("inputTokens", 0) for c in siklus), default=0)
    return total.get("inputTokens", 0), total.get("outputTokens", 0), terbesar


def jalankan(tugas: str, store: int | None = None, client: httpx.Client | None = None, verbose: bool = True) -> dict:
    client = client or httpx.Client(base_url=config.API_URL, timeout=60)
    run_id = uuid4().hex[:12]
    alat = AlatAgent(client, run_id, pembuat=f"agent ChibiRex ({nama_model()})", verbose=verbose)
    agent = Agent(model=buat_model(), tools=alat.tools(), system_prompt=SYSTEM_PROMPT, callback_handler=None)

    if verbose:
        print(f"Agent {run_id} | {nama_model()}\nTugas: {tugas}")
    mulai = time.perf_counter()
    try:
        hasil = agent(tugas)
        jawaban, berhasil = str(hasil).strip(), True
        token_in, token_out, terbesar = _token(hasil)
    except Exception as e:  # model atau server mati di tengah jalan: tetap simpan jejaknya
        jawaban, berhasil, token_in, token_out, terbesar = f"Agent gagal: {e}", False, 0, 0, 0
    durasi = round(time.perf_counter() - mulai, 1)

    jejak = {"run_id": run_id, "tugas": tugas, "store": store, "model": nama_model(), "jawaban": jawaban,
             "langkah": alat.langkah, "durasi_dtk": durasi, "token_input": token_in, "token_output": token_out,
             "berhasil": berhasil}
    client.post("/agent-runs", json=jejak).raise_for_status()

    if verbose:
        print(f"\n{jawaban}\n")
        print(f"[{durasi} dtk | {len(alat.langkah)} tool | token input {token_in}, output {token_out} | "
              f"input terbesar per panggilan {terbesar}]")
        if config.LLM_PROVIDER == "ollama" and terbesar > 0.85 * config.OLLAMA_NUM_CTX:
            print(f"[peringatan] Mendekati batas konteks {config.OLLAMA_NUM_CTX} token; naikkan CHIBIREX_OLLAMA_NUM_CTX.")
    return jejak


def main() -> None:
    p = argparse.ArgumentParser(description="Jalankan agent ChibiRex untuk satu toko.")
    p.add_argument("--store", type=int, default=74)
    p.add_argument("--tugas", help="Instruksi untuk agent (default: tinjau toko sesuai prosedur).")
    args = p.parse_args()
    tugas = args.tugas or f"Tinjau toko {args.store} dan ambil tindakan untuk SKU prioritas sesuai prosedur."
    jalankan(tugas, store=args.store)


if __name__ == "__main__":
    main()
