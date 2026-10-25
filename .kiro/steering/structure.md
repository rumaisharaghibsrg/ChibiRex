# Project Structure

## Root Layout

```
ChibiRex/
├── agent/          # Strands AI agent: LLM wrappers, tool definitions, worker, run entry point
├── api/            # FastAPI backend: routes, schemas, guardrails, SAP integration, settings
├── dashboard/      # React + Vite frontend
├── virtual_hq/     # Virtual HQ: Phaser 4 + React 2D office; NPCs read the same API as the dashboard (src/lib/api.js)
├── engine/         # Offline analytics pipeline (runs separately, produces chibirex.duckdb)
├── sap_mock/       # SAP OData V2 mock; mounted inside the API at /sap
├── copilot/        # Lambda rexa-copilot (outside VPC), read-only API tools: chatbot (inti.py, Haiku 4.5) and network agent (jaringan.py, Sonnet 4.6)
├── data/
│   ├── raw/        # Source CSVs from Kaggle (Bibitor, Instacart, backorders, online retail)
│   └── processed/  # Generated artifacts: chibirex.duckdb, state.sqlite, sap_mock.sqlite
├── models/         # Saved ML model artifacts (LightGBM stockout risk model)
├── deploy/         # PowerShell scripts: deploy_lambda.ps1, deploy_dashboard.ps1, worker_otomatis.ps1 (worker at Windows login)
├── docs/           # Architecture diagrams (arsitektur.md), API contract, PDF proposals
├── tests/          # pytest test suite
├── .env            # Environment variables (CHIBIREX_* prefixed; not committed)
├── requirements.txt           # Full dev dependencies (tested on Python 3.14.5)
├── requirements-lambda.txt    # Minimal Lambda image dependencies
├── Dockerfile      # Lambda container image definition
└── pytest.ini      # Test configuration
```

## agent/

The Strands-based AI agent that drives inventory decisions.

| File | Purpose |
|---|---|
| `config.py` | Reads all `CHIBIREX_*` env vars; LLM provider, Ollama/Bedrock settings, API URL, worker token |
| `llm.py` | Factory: returns `OllamaModel` or `BedrockModel` based on `CHIBIREX_LLM_PROVIDER` |
| `prompt.py` | `SYSTEM_PROMPT` (5-step procedure + rules) and `TUGAS_DEFAULT` task template |
| `tools.py` | `AlatAgent` class — creates 6 Strands `@tool` functions bound to one HTTP client + run_id; strips API responses to LLM-relevant fields only (for 8K context budget) |
| `run.py` | `jalankan()` entry point — instantiates Agent, runs it, saves trace to API; CLI: `python -m agent.run --store 74` |
| `worker.py` | Queue-polling worker for Lambda mode — polls `/agent-runs/antrian/ambil`, runs the agent on the laptop with the LLM set in `.env` (Bedrock Claude Sonnet 4.6, or Ollama), streams steps back to API; CLI: `python -m agent.worker` |
| `cek_llm.py` | Connectivity check for Ollama |
| `cek_bedrock.py` | Connectivity check + model selection for Bedrock |
| `reset_demo.py` | Resets demo state data |
| `skenario_*.py` | Pre-scripted demo scenarios |

**Agent tools** (defined in `tools.py`, all call the REST API):
`list_prioritas` → `check_substitution` → `hold_reorder` → `suggest_reallocation` → `draft_purchase_order` (+ `get_sku_metrics` for detail on demand)

## api/

The FastAPI application. All agent actions and dashboard calls go through here; guardrails are enforced here.

| File | Purpose |
|---|---|
| `main.py` | All route definitions; guardrail enforcement; SAP integration; idempotency; circuit breaker; agent run management. `create_app()` is the factory; `siapkan()` opens DuckDB at startup |
| `schemas.py` | Single source of truth for all Pydantic models (`Sku`, `PurchaseOrder`, `Hold`, `AgentRun`, status enums, etc.) |
| `settings.py` | `Settings` dataclass — guardrail thresholds, agent mode (`lokal`/`antrian`/`mati`), CORS origins, SAP config, worker timeouts |
| `guardrails.py` | Guardrail check helpers called by route handlers |
| `state.py` | SQLite connection helpers: `transaksi()` and `baca()` context managers |
| `simulasi.py` | Simulation clock from 31 Dec 2016: daily demand depletes stock, approved POs arrive after lead time. `terapkan()` builds a per-request temp table named `sku_metrics` that shadows the read-only DuckDB table, so existing queries read simulated stock unchanged |
| `sap.py` | SAP OData V2 integration helpers (CSRF fetch + PO POST) |
| `agent_runner.py` | `PenjalanAgent` — runs agent in local thread or queue mode; `jalankan_agent_lokal()` |
| `lambda_handler.py` | `handler = Mangum(app)` — AWS Lambda entry point |

**Route groups** (tagged in OpenAPI docs):
- `Tools agent` — read + write endpoints the agent calls
- `Approval manusia` — `approve`/`reject` PO endpoints for the manager
- `Guardrail & audit` — guardrail status, circuit breaker reset, audit log, health check
- `Jejak agent` — agent run lifecycle and queue
- `Dashboard` — store summaries, health scores

## dashboard/

React SPA. No routing library — page state managed with `useState` in `App.jsx`.

```
dashboard/
├── src/
│   ├── App.jsx           # 4-page router: landing → auth → onboarding → dashboard
│   ├── components/       # All React components (flat, no subdirectory grouping)
│   └── lib/
│       ├── api.js         # REST client; all API endpoints mapped; ApiError class
│       ├── format.js      # Rupiah, number, and date formatting helpers
│       ├── useDataToko.js # Hook: loads all data for one store; joins SKU rows with PO/hold by inventory_id
│       ├── skenario.js    # "Skenario Uji" menu: Runaway PO and stock-count mismatch via real API calls
│       └── copilot.js     # Copilot answers computed from API data (no LLM yet)
├── public/               # Static assets (logos, SVG icons)
├── .env.local            # VITE_API_URL (not committed; defaults to localhost:8000)
├── package.json
└── vite.config.js
```

Key components:

| Component | Purpose |
|---|---|
| `DashboardApp.jsx` | Main dashboard shell; loads store data with `useDataToko(store, refreshKey)` and passes it to every panel. All panels use API data (no mock data left) |
| `Header.jsx` | Store selector (`GET /stores`), autonomy level info (only Level 2 active), "Skenario Uji" menu, API status + data date |
| `TopKeyMetricsRow.jsx` | Inventory Health (score + 3 components), capital saved, stockout-risk SKUs |
| `AgentRunPanel.jsx` | Trigger agent run; poll status (MENUNGGU/BERJALAN/SELESAI/GAGAL); show each tool call live as Plan → Reason → Act → Review; show worker status |
| `SmartReorderTable.jsx` | REORDER SKUs joined with PO/hold status; opens PO approval or hold detail |
| `PendingPoCard.jsx` | List of DRAFT POs awaiting 1-Click Approval |
| `PoApprovalModal.jsx` | Modal for approve/reject with manager comment |
| `SuppressionDetailModal.jsx` | Hold Reorder detail: agent reason, complementarity check, capital saved, test stock |
| `CapitalReallocationCard.jsx` | Reallocation from held reorders to rising SKUs; button opens the target draft PO |
| `GuardrailsModal.jsx` | Live guardrail status, manager reset of the circuit breaker, pending stock audits, audit log |
| `KpiGrid.jsx` | Key metric cards (reallocation tab) |
| `JaringanToko.jsx` | "Semua Toko" tab: network KPIs, Health Score chart and sortable table for all stores (`GET /jaringan/ringkasan`), inter-store transfer opportunities (`GET /jaringan/transfer`), and the network agent (`POST {VITE_COPILOT_URL}/jaringan`). Clicking a store opens its dashboard |
| `RekapAgent.jsx` | "Rekap Agent" tab: agent runs, holds, draft POs, and manager decisions per simulated day (`GET /stores/{store}/rekap`); CSV download and print/PDF |
| `AiCopilotWidget.jsx` | Chat with Rexa Copilot (`POST {VITE_COPILOT_URL}/tanya`, Claude on Bedrock); falls back to quick answers from dashboard data (`lib/copilot.js`) |
| `HealthScoreCard.jsx`, `FormulaModal.jsx`, `ScenarioBar.jsx`, `AgenticPipelineVisualizer.jsx` | Leftovers from the original design; not used |

## engine/

Offline analytics pipeline. Run with `python -m engine.pipeline` (stop the API first — DuckDB can't be written while the API holds it open). Produces `data/processed/chibirex.duckdb`.

Contains: stock reconstruction, demand velocity (Vs), reorder point calculation, safety stock, LightGBM stockout risk model, market basket complementarity analysis, brand/product type classification.

## sap_mock/

A self-contained FastAPI mini-app implementing SAP OData V2 `API_PURCHASEORDER_PROCESS_SRV`. Mounted at `/sap` inside the main API. In Lambda, called in-process (no separate server). State stored in `sap_mock.sqlite`.

## Naming Conventions

- **Python**: Indonesian throughout — functions, variables, field names, error codes. E.g. `siapkan` (setup), `tutup` (teardown), `galat` (error), `jalankan` (run), `ambil_tugas` (fetch task). Private helpers prefixed with `_`.
- **JavaScript**: Indonesian camelCase for domain objects (`ringkasan`, `daftarPo`, `mulaiAgent`); English for React/technical terms.
- **API error shape**: `{"detail": {"kode": "ERROR_CODE", "pesan": "Human readable message"}}` — used consistently by both the JS `ApiError` class and agent tool response handling.
- **Idempotency keys**: required on `POST /purchase-orders` and `POST /holds` (header `Idempotency-Key`); format for agent calls: `agent-{run_id}-{action}-{inventory_id}`. Approve, reject and reset endpoints don't need one.
- **Dashboard data rule**: every number on the dashboard must come from the API through `src/lib/api.js`; do not add new mock data or invented KPIs.
