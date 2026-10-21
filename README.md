# SupplyChainX

A cloud-ready supply-chain risk intelligence platform that turns shipment history and explicitly labelled scenario data into operational risk signals.

> **Project status:** foundation stage. AWS deployment has not been performed yet. Supplier identities, warehouse mappings, inventory scenarios, and some dashboard values are synthetic/illustrative. Historical shipment records are retrospective, not forecasts. See [data provenance](docs/DATA_PROVENANCE.md).

## Current features

- Responsive React + TypeScript dashboard shell with risk register, filters, CSV export, delivery-trend visualisation, and prototype-data notices
- FastAPI service with health and overview endpoints plus interactive API docs
- Initial Pydantic response schemas
- Starter API tests and CI workflow for backend tests and frontend build
- Dockerfile and Docker Compose for the API
- Data provenance and implementation roadmap documentation

**Important:** supplier cards, sample chart points, risk bands, and KPI figures in the first dashboard are illustrative design fixtures. They are not yet calculated from the historical data bundle and must not be presented as observed business performance.

## Stack

- **Frontend:** React, TypeScript, Vite, Recharts, Lucide
- **API:** Python, FastAPI, Pydantic
- **Analytics (planned/integration):** pandas / NumPy and the validated risk engine
- **Local demo:** SQLite will be used when the validated data layer is integrated
- **Cloud target:** AWS (deployment to be documented after it is configured)

## Repository layout

```text
SupplyChainX/
├── .github/workflows/ci.yml
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   └── services/
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── docs/
│   ├── DATA_PROVENANCE.md
│   └── ROADMAP.md
├── docker-compose.yml
└── README.md
```

## Run locally

### Start the API

Requires Python 3.11+ (CI uses Python 3.12).

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for interactive API docs.

### Start the frontend

In another terminal, from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dashboard currently uses clearly disclosed illustrative UI fixtures. Once the validated data layer is connected, these will be replaced by API-derived values.

### Docker (API only)

From the repository root:

```bash
docker compose up --build
```

## Data and interpretation

- Historical shipment outcomes describe past deliveries, not guaranteed future outcomes.
- Synthetic supplier and inventory scenario records are included to demonstrate workflow behaviour.
- Demo risk thresholds are calibration choices, not industry standards.
- Review [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md) before presenting results.
- Do not claim predictive accuracy until a properly held-out or prospective evaluation has been run and documented.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the build sequence: validated data integration, API analytics endpoints, functional dashboard data, automated checks, then a controlled AWS deployment plan.
