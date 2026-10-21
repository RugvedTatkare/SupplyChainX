# Implementation roadmap

## Phase 1 — Foundation
- [x] Establish repository structure and project scope
- [x] Add API entry point, contracts, and starter tests
- [x] Document data-provenance boundaries
- [ ] Wire validated risk-engine and local database

## Phase 2 — Operational API
- Supplier risk listing and detail endpoints
- Shipment and inventory analytics
- Input validation, filters, pagination, meaningful API errors
- API tests against a small deterministic fixture

## Phase 3 — Dashboard
- Responsive overview page and sidebar navigation
- Risk KPI cards and shipment trend visualisation
- Supplier risk table and filters
- Clear labels for historical and synthetic information

## Phase 4 — Quality and cloud
- Reproducible test run and CI workflow
- Containerised local development
- AWS deployment design and environment configuration
- Deploy only after cloud permissions, account, cost controls, and secrets are configured

## Acceptance principles
- No fabricated “live” KPIs: missing data should be represented honestly.
- Synthetic records remain labelled in the UI and exports.
- Risk calculations are deterministic and unit-tested.
- Cloud deployment is not described as complete before an actual deploy succeeds.
