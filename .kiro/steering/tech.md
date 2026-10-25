# Tech Stack

## Backend (Python)

- **Language**: Python 3.14.5 (dev); Lambda uses 3.12
- **API framework**: FastAPI 0.143.3 + Uvicorn 0.54.0
- **Data validation**: Pydantic 2.14.1 (models in `api/schemas.py`)
- **Settings**: `@dataclass` in `api/settings.py` (not Pydantic Settings)
- **Databases**:
  - `chibirex.duckdb` — read-only analytics store (DuckDB 1.5.6); queried at runtime
  - `state.sqlite` — transactional state (SQLite): POs, holds, audit log, agent run queue
  - `sap_mock.sqlite` — SAP OData mock state
- **HTTP client**: httpx 0.28.1
- **Agent framework**: strands-agents 1.61.1
- **LLM providers**: Ollama 0.6.3 (local, default) or Amazon Bedrock via boto3 1.43.114
- **Analytics pipeline**: pandas 2.3.3, pyarrow 26.0.0, scikit-learn 1.9.1, lightgbm 4.7.0, statsforecast 2.1.1
- **Lambda adapter**: mangum 0.22.0
- **Testing**: pytest 9.1.1
- **Other**: python-dotenv 1.2.4, awscrt 0.36.0 (required for Bedrock credentials)

## Frontend (JavaScript)

- **Framework**: React 19.2.8 (JSX, no TypeScript)
- **Build tool**: Vite 8.3.0 + `@vitejs/plugin-react`
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin (no `tailwind.config.js` or PostCSS needed)
- **Icons**: lucide-react 1.59.0
- **Utilities**: clsx, tailwind-merge, canvas-confetti
- **Linter**: oxlint (not ESLint) — config at `dashboard/.oxlintrc.json`
- **No routing library** — page switching via `useState` in `App.jsx`
- **No state management library** — props passed down component tree
- **API communication**: plain `fetch()` wrapped in `dashboard/src/lib/api.js`; API base URL via `VITE_API_URL`

## Infrastructure

- AWS Lambda (container image, `ap-southeast-2`) for the Tools API
- AWS Amplify for dashboard hosting (the only official link; the old Vercel deployment is no longer used)
- Amazon EFS for persistent SQLite state across Lambda cold starts
- LLM for the demo and final (since 25 Oct 2026): Claude Sonnet 4.6 on Amazon Bedrock (`au.anthropic.claude-sonnet-4-6`, `ap-southeast-2`), authenticated with a Bedrock API key (`AWS_BEARER_TOKEN_BEDROCK` in `.env`). The Strands agent itself still runs on the presenter's laptop through the queue worker (`python -m agent.worker`, auto-started at login). Ollama `qwen3:14b` remains a local fallback (`CHIBIREX_LLM_PROVIDER=ollama`). Available to the team account: Sonnet 4.6 and Opus 4.6; Sonnet 4.5 needs the Anthropic use-case form; 5.5 models are not available. Nova models still have a token quota of 0.

## Environment Variables

All variables are prefixed `CHIBIREX_`. Key ones:

| Variable | Purpose |
|---|---|
| `CHIBIREX_LLM_PROVIDER` | `ollama` (default) or `bedrock` |
| `CHIBIREX_OLLAMA_HOST` | Ollama server URL (default `http://localhost:11434`) |
| `CHIBIREX_OLLAMA_MODEL` | Model name (default `qwen3:14b`) |
| `CHIBIREX_OLLAMA_NUM_CTX` | Context window size (default 8192; keep ≤8K for full GPU) |
| `CHIBIREX_BEDROCK_REGION` | AWS region for Bedrock |
| `CHIBIREX_BEDROCK_MODEL_ID` | Bedrock model ID |
| `CHIBIREX_API_URL` | API base URL for the agent (default `http://127.0.0.1:8000`) |
| `CHIBIREX_WORKER_API_URL` | API URL for the queue worker (Lambda URL in production) |
| `CHIBIREX_WORKER_TOKEN` | Shared secret for worker authentication (`X-Worker-Token` header) |
| `CHIBIREX_AGENT_MODE` | `lokal`, `antrian`, or `mati` |
| `CHIBIREX_CORS_ORIGINS` | Comma-separated allowed origins |
| `CHIBIREX_SAP_URL` | Override SAP OData endpoint (default: in-process mock) |
| `CHIBIREX_STATE_DB` | Path override for state.sqlite |
| `VITE_API_URL` | (dashboard only) API base URL, set in `dashboard/.env.local` |

## Common Commands

### Backend

```powershell
# Start development API server
uvicorn api.main:app --reload

# Run the agent directly for a store
python -m agent.run --store 74
python -m agent.run --store 74 --tugas "Custom instruction"

# Start the queue worker (for Lambda + local LLM mode)
python -m agent.worker
# ...or install it to start hidden at Windows login (log: logs\worker.log; -Status / -Hapus)
.\deploy\worker_otomatis.ps1

# Run tests
pytest

# Check LLM connectivity
python -m agent.cek_llm        # Ollama
python -m agent.cek_bedrock    # AWS Bedrock

# Reset demo data
python -m agent.reset_demo

# Run the offline analytics pipeline (rebuilds chibirex.duckdb)
# Stop the API first — DuckDB cannot be written while API holds a read connection
python -m engine.pipeline
```

### Frontend (run from `dashboard/`)

```powershell
npm run dev       # Vite dev server on http://localhost:5173
npm run build     # Production build → dashboard/dist/
npm run preview   # Serve production build locally
npm run lint      # oxlint
```

### Deploy

```powershell
# Deploy API to AWS Lambda (from repo root)
.\deploy\deploy_lambda.ps1

# Deploy the chatbot Lambda rexa-copilot (outside the VPC; Claude on Bedrock via IAM role)
.\deploy\deploy_copilot.ps1

# Deploy dashboard to AWS Amplify (app rexa-dashboard); picks up the API and Copilot URLs
.\deploy\deploy_dashboard.ps1
```
