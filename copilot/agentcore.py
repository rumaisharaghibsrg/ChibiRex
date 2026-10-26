"""Membangunkan agent toko di Amazon Bedrock AgentCore Runtime (`POST /agent` di Lambda Copilot).

Dashboard dan Virtual HQ memanggil ini tepat setelah `POST /agent-runs/mulai` menaruh tugas di antrian API. Lambda API
tidak bisa memanggil AgentCore sendiri karena berada di VPC tanpa akses keluar, dan browser tidak punya kredensial
AWS; Lambda Copilot di luar VPC dan memakai izin role-nya. Runtime menjawab segera lalu mengerjakan tugas di latar
(agent/agentcore.py), jadi permintaan ini hanya beberapa detik walaupun agent butuh puluhan detik.
"""

import json
import os
import uuid

# Diisi deploy\deploy_copilot.ps1 dari runtime yang dibuat deploy\deploy_agent.ps1. Kosong = belum di-deploy.
RUNTIME_ARN = os.environ.get("AGENT_RUNTIME_ARN", "")


class AgentCoreBelumAda(Exception):
    pass


def bangunkan(run_id: str | None, invoke=None) -> dict:
    """Panggil runtime dengan sesi baru (satu microVM per run, ditutup AgentCore setelah menganggur)."""
    if not RUNTIME_ARN:
        raise AgentCoreBelumAda()
    if invoke is None:
        import boto3

        region = RUNTIME_ARN.split(":")[3]  # arn:aws:bedrock-agentcore:<region>:<akun>:runtime/<id>
        invoke = boto3.client("bedrock-agentcore", region_name=region).invoke_agent_runtime
    sesi = f"rexa-agent-toko-{uuid.uuid4().hex}"  # AgentCore mewajibkan minimal 33 karakter
    r = invoke(agentRuntimeArn=RUNTIME_ARN, runtimeSessionId=sesi, contentType="application/json",
               accept="application/json", payload=json.dumps({"run_id": run_id}).encode())
    return json.loads(r["response"].read())
