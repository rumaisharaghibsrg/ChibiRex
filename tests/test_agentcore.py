"""Uji agent di Bedrock AgentCore tanpa AWS: pemicu `POST /agent` di Lambda Copilot (InvokeAgentRuntime diganti
tiruan) dan entrypoint runtime (agent/agentcore.py) dengan antrian tiruan."""

import io
import json
import threading
import time

from bedrock_agentcore.runtime.models import PingStatus

from agent import agentcore as runtime
from copilot import agentcore, lambda_handler

ARN = "arn:aws:bedrock-agentcore:ap-southeast-2:123456789012:runtime/rexa_agent_toko-AbCdEfGhIj"


def _event(path: str, body: dict | str | None = None, metode: str = "POST") -> dict:
    isi = body if isinstance(body, str) else json.dumps(body or {})
    return {"rawPath": path, "requestContext": {"http": {"method": metode}}, "body": isi}


def test_bangunkan_memanggil_runtime_dengan_sesi_baru(monkeypatch):
    monkeypatch.setattr(agentcore, "RUNTIME_ARN", ARN)
    panggilan = []

    def invoke(**kw):
        panggilan.append(kw)
        return {"response": io.BytesIO(b'{"status": "diterima", "run_id": "abc123"}')}

    assert agentcore.bangunkan("abc123", invoke=invoke) == {"status": "diterima", "run_id": "abc123"}
    assert agentcore.bangunkan("abc123", invoke=invoke)["status"] == "diterima"
    pertama, kedua = panggilan
    assert pertama["agentRuntimeArn"] == ARN and json.loads(pertama["payload"]) == {"run_id": "abc123"}
    assert len(pertama["runtimeSessionId"]) >= 33 and pertama["runtimeSessionId"] != kedua["runtimeSessionId"]


def test_route_agent(monkeypatch):
    monkeypatch.setattr(agentcore, "RUNTIME_ARN", "")
    r = lambda_handler.handler(_event("/agent", {"run_id": "abc123"}), None)
    assert r["statusCode"] == 503 and json.loads(r["body"])["detail"]["kode"] == "AGENTCORE_BELUM_ADA"
    assert json.loads(lambda_handler.handler(_event("/", metode="GET"), None)["body"])["agentcore"] is False

    monkeypatch.setattr(agentcore, "RUNTIME_ARN", ARN)
    monkeypatch.setattr(agentcore, "bangunkan", lambda run_id: {"status": "diterima", "run_id": run_id})
    r = lambda_handler.handler(_event("/agent", {"run_id": "abc123"}), None)
    assert r["statusCode"] == 202 and json.loads(r["body"]) == {"status": "diterima", "run_id": "abc123"}
    assert lambda_handler.handler(_event("/agent", {"run_id": "../x y"}), None)["statusCode"] == 422
    assert lambda_handler.handler(_event("/agent", "[1]"), None)["statusCode"] == 422

    def gagal(run_id):
        raise RuntimeError("AccessDenied")

    monkeypatch.setattr(agentcore, "bangunkan", gagal)
    r = lambda_handler.handler(_event("/agent", {}), None)
    assert r["statusCode"] == 502 and "AccessDenied" not in r["body"]  # detail AWS hanya ke CloudWatch


def test_entrypoint_menjawab_segera_lalu_bekerja_di_latar(monkeypatch):
    lanjut, selesai, nama_worker = threading.Event(), threading.Event(), []

    def kerjakan_satu(client, nama):
        nama_worker.append(nama)
        lanjut.wait(5)  # agent "berpikir" sampai test mengizinkan
        selesai.set()
        return True

    monkeypatch.setattr(runtime, "kerjakan_satu", kerjakan_satu)
    assert runtime.mulai({"run_id": "abc123"}) == {"status": "diterima", "run_id": "abc123"}
    # Selama agent bekerja sesi dilaporkan sibuk, supaya AgentCore tidak menghentikannya karena dianggap menganggur.
    assert runtime.app.get_current_ping_status() == PingStatus.HEALTHY_BUSY
    lanjut.set()
    assert selesai.wait(5)
    for _ in range(50):
        if runtime.app.get_current_ping_status() == PingStatus.HEALTHY:
            break
        time.sleep(0.05)
    assert runtime.app.get_current_ping_status() == PingStatus.HEALTHY
    assert nama_worker == ["bedrock-agentcore"]


def test_entrypoint_tetap_sehat_kalau_api_menolak(monkeypatch):
    def ditolak(client, nama):
        raise SystemExit("Token worker ditolak API.")

    monkeypatch.setattr(runtime, "kerjakan_satu", ditolak)
    task_lama = set(runtime.app._active_tasks)
    runtime.mulai({})
    for _ in range(50):
        if set(runtime.app._active_tasks) <= task_lama:
            break
        time.sleep(0.05)
    assert set(runtime.app._active_tasks) <= task_lama  # tugas latar ditutup walaupun gagal
