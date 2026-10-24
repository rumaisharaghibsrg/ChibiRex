# Arsitektur Rexa

Diagram untuk Zoom mentoring dan slide final. Label memakai bahasa Inggris karena presentasi final berbahasa Inggris. Diagram ini tampil langsung di GitHub (Mermaid).

## Target final di AWS

```mermaid
flowchart LR
    manager(["Store manager"])

    subgraph aws["AWS (ap-southeast-2)"]
        dash["Rexa Dashboard<br/>React · Amplify / S3 + CloudFront"]
        api["Tools API · FastAPI<br/>AWS Lambda"]
        guard{{"Guardrails in code<br/>3σ outlier · daily spend cap<br/>circuit breaker · idempotency<br/>Draft by default"}}
        agent["Rexa Agent · Strands Agents<br/>Bedrock AgentCore Runtime"]
        llm["Amazon Bedrock<br/>Nova / Claude"]
        state[("Transactional state<br/>POs · holds · audit log<br/>managed DB")]
        analytics[("Analytics store<br/>Vs · ROP · risk score<br/>substitution rules")]
    end

    sap["SAP S/4HANA<br/>Purchase Order API (OData)<br/>mock for the MVP"]

    subgraph offline["Offline pipeline (engine/)"]
        data["Kaggle datasets<br/>Bibitor · Instacart<br/>Product Backorders · Online Retail II"]
        engine["Stock reconstruction · Vs · ROP<br/>market basket · LightGBM risk model"]
    end

    manager -- "run agent · 1-Click Approval" --> dash
    dash -- "REST" --> api
    api -- "start run" --> agent
    agent -- "reasoning" --> llm
    agent -- "6 tools over HTTP" --> api
    api --- guard
    api --> state
    api --> analytics
    api -- "approved PO only<br/>CSRF + POST A_PurchaseOrder" --> sap
    data --> engine --> analytics
```

## Loop agentic: plan → reason → act → review, dengan manusia di akhir

```mermaid
sequenceDiagram
    actor Manager as Store manager
    participant Dash as Dashboard
    participant API as Tools API + guardrails
    participant Agent as Rexa Agent (Strands + LLM)
    participant SAP as SAP S/4HANA (mock)

    Manager->>Dash: Run agent for store 74
    Dash->>API: POST /agent-runs/mulai
    API->>Agent: start run
    Agent->>API: PLAN · list_prioritas
    Agent->>API: REASON · check_substitution
    Agent->>API: ACT · hold_reorder / draft_purchase_order
    API-->>Agent: REVIEW · DRAFT or DITAHAN_GUARDRAIL (code, not prompt)
    Agent->>API: save trace + summary
    Dash->>API: GET /agent-runs/{id} (live steps)
    Manager->>Dash: 1-Click Approval
    Dash->>API: POST /purchase-orders/{id}/approve
    API->>SAP: fetch CSRF token, POST A_PurchaseOrder
    SAP-->>API: PO 4500000001
    API-->>Dash: approved, SAP PO number
```

## Posisi sekarang vs target final

| Komponen | Sekarang (25 Okt 2026) | Target final |
|---|---|---|
| Dashboard | **AWS Amplify** (`main.d30b19xkk8lknt.amplifyapp.com`); Vercel dan lokal tetap ada | AWS Amplify |
| Tools API | AWS Lambda (container image, Function URL, Sydney) di VPC; deploy dari repo (`deploy\deploy_lambda.ps1`) | Lambda (+ API Gateway bila perlu) |
| Agent | Strands di laptop lewat worker yang mengambil tugas dari antrian API; LLM **Claude Sonnet 4.6 di Amazon Bedrock** (Ollama `qwen3:14b` sebagai cadangan lokal) | Bedrock AgentCore Runtime + Amazon Bedrock |
| State transaksi | SQLite di **Amazon EFS** (dipakai bersama semua instance, tidak hilang saat cold start) | Database terkelola (RDS/DynamoDB) |
| Data analitik | DuckDB ikut di-deploy bersama API | Tetap DuckDB (hanya dibaca), disimpan di S3 |
| SAP | Tiruan OData V2 `API_PURCHASEORDER_PROCESS_SRV` di dalam API | Tetap tiruan; opsional SAP riil (OData V4 `CE_PURCHASEORDER_0001`) |

## Prinsip desain yang ditekankan ke juri

- **Guardrail di kode, bukan di prompt.** Agent hanya bisa bertindak lewat 6 tools di API. Batas 3σ, batas nominal harian, circuit breaker, idempotency key, dan status Draft dicek di server, jadi prompt injection atau model yang keliru tidak bisa melewatinya.
- **Manusia tetap memutuskan.** Agent hanya menyusun draf (Level 2). PO baru masuk SAP setelah manajer menekan 1-Click Approval, dan kalau SAP gagal, PO tetap draf.
- **Tidak terikat satu penyedia model.** Ollama (lokal) dan Amazon Bedrock dipilih lewat satu variabel lingkungan; kode agent sama.
- **Angka dari data, bukan dari LLM.** Vs, reorder point, skor risiko, dan substitusi dihitung oleh pipeline; LLM hanya memilih tindakan dan menjelaskannya.
