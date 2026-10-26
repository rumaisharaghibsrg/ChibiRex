# ChibiRex / Rexa — Product Summary

**Rexa** is an agentic AI copilot for retail inventory and cash flow management. It helps store managers reduce stockouts and free up capital locked in slow-moving inventory.

## Core Capabilities

- **Agentic inventory review**: a Strands-based LLM agent (persona "Rexa") follows a strict 5-step procedure — list priority SKUs → check complementary-product role → hold declining SKUs → suggest capital reallocation → draft purchase orders for rising SKUs.
- **Guardrails in code, not in prompt**: all risk controls (3σ outlier cap, daily spend cap of IDR 100M, circuit breaker, idempotency, always-DRAFT PO status) are enforced server-side. The LLM cannot bypass them.
- **Human-in-the-loop**: the agent only creates DRAFT purchase orders. A store manager must press 1-Click Approval before any PO is submitted to SAP.
- **Numbers from data, not from LLM**: reorder points, demand velocity (Vs), stockout risk scores, and complementarity status are all pre-computed by the offline analytics pipeline. The LLM only selects actions and explains them.
- **Capital reallocation**: budget freed by held reorders is redirected to trending-up SKUs; 10% exploration budget is preserved per hold to prevent a "death spiral".
- **SAP integration**: approved POs are posted to an SAP S/4HANA OData V2 mock (`API_PURCHASEORDER_PROCESS_SRV`); a real SAP endpoint can be substituted via environment variable.
- **Network view (all stores)**: the "Semua Toko" page shows every store's health and stock statistics side by side, plus inter-store transfer opportunities (excess stock in one store covering another store's reorder). A read-only network agent (Claude Sonnet 4.6) scans all stores, picks the 3-5 most critical with data-backed reasons and actions, and selects the best transfers; every store and transfer it names is validated against the API before the report is accepted.
- **Simulation clock**: the Bibitor data ends on 31 Dec 2016; the dashboard advances time from there (+1/+7 days or automatic). Stock depletes by daily demand, approved POs arrive after the vendor lead time, and health score and agent priorities change accordingly.

## Domain Language

Key domain terms used throughout the codebase (Indonesian):

| Term | Meaning |
|---|---|
| `inventory_id` | SKU identifier: `{store}_{KOTA}_{brand}`, e.g. `74_PAENTMARWY_4222` |
| `perlu_reorder` | boolean — SKU needs restocking |
| `arah_tren` | sales trend direction: `NAIK` / `TURUN` / `STABIL` / `TIDAK_ANDAL` |
| `status_stok` | `AMAN`, `REORDER`, `OVERSTOCK`, `DEADSTOCK`, `TIDAK_AKTIF` |
| `saran_qty_po` | system-suggested PO quantity |
| `hold_reorder` | action to suspend a reorder for a declining SKU |
| `guardrail` | automated server-side constraint that can block or flag a PO |
| `circuit breaker` | opens after 3 guardrail violations in 60 min; blocks all new POs |
| `data_confidence` | 0–1 score; drops when unaudited physical stock counts differ from system |
| `DITAHAN_GUARDRAIL` | PO status when blocked by a guardrail rule |

## Current Deployment State (as of Oct 2026)

- Dashboard: AWS Amplify (`main.d30b19xkk8lknt.amplifyapp.com`)
- Tools API: AWS Lambda (container image, Function URL, `ap-southeast-2`)
- Agent LLM: Claude Sonnet 4.6 on Amazon Bedrock. The Strands agent runs on Amazon Bedrock AgentCore Runtime (`rexa_agent_toko`, woken by the Copilot Lambda, deployed with `deploy\deploy_agent.ps1`); the queue-polling worker on the presenter's laptop is the fallback (Ollama `qwen3:14b` as local LLM fallback)
- Analytics DB: DuckDB deployed with Lambda image
- Transactional state: SQLite on Amazon EFS (shared across Lambda instances)
- SAP: OData V2 mock (production SAP optional via `CHIBIREX_SAP_URL`)
