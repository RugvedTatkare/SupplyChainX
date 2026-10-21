# SupplyChainX

A cloud-ready supply-chain risk intelligence platform that turns shipment history and explicitly labelled scenario data into operational risk signals.

> **Project status:** foundation stage. AWS deployment has not been performed yet. Supplier identities, warehouse mappings, and inventory scenarios are synthetic demo data; historical shipment records are retrospective and are not forecasts.

## Planned capabilities

- Shipment-delay and delivery-performance analytics
- Supplier risk scoring with explainable component scores
- Inventory exposure scenarios and risk-event exploration
- FastAPI service for analytics and dashboard data
- React dashboard for operational visibility
- Automated tests and a cloud deployment path for AWS

## Architecture

- **Frontend:** React + TypeScript + Vite
- **API:** Python + FastAPI
- **Analytics:** pandas / NumPy; transparent, testable risk-engine rules
- **Database:** SQLite for local demo; PostgreSQL or AWS-managed database can be added for deployment
- **Cloud target:** AWS (deployment to be documented after it is configured)

## Repository layout

```text
SupplyChainX/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py
│   │   └── services/
│   └── tests/
├── frontend/
├── data/
├── docs/
├── scripts/
├── .github/workflows/
├── .gitignore
├── docker-compose.yml
└── README.md
```

## Quick start

The local run instructions will be added alongside the API and frontend setup. Keep the sample data provenance notes with any analysis or presentation; do not describe synthetic scenarios as real supplier data.

## Data and interpretation notes

- Historical shipment outcomes describe past deliveries, not guaranteed future outcomes.
- Synthetic supplier and inventory scenario records are included to demonstrate workflow behaviour.
- Risk bands are demo thresholds, not certified industry standards.
- Review `docs/DATA_PROVENANCE.md` before presenting results.

## Development principles

1. Make risk indicators interpretable and reproducible.
2. Keep synthetic and historical data clearly distinguished.
3. Test business logic and API contracts.
4. Keep secrets out of source control; use environment variables for credentials.
