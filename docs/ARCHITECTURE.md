# Architecture

## Local development flow

```text
React + TypeScript (Vite :5173)
            |
            | HTTP GET /api/*
            v
FastAPI (:8000)
            |
            v
Analytics / risk engine (integration pending)
            |
            v
Validated historical data + labelled synthetic scenarios
```

The foundation provides a frontend shell, health/overview API contract, and repository quality scaffolding. Dashboard tables and charts currently contain illustrative UI fixtures; the next implementation step is to connect the validated database and risk engine so metrics are derived from data.

## Planned AWS direction

A sensible first deployment topology is a static frontend hosted on an AWS static-site path or managed frontend service, an API container on AWS App Runner or ECS, and a managed relational database only when multi-user deployment is needed. Select the option after reviewing course requirements, available account permissions, cost budget, and networking/security constraints.

Do not commit AWS access keys, `.env` files, database credentials, or personally identifying operational records. Use IAM roles and a managed secrets mechanism for a real deployment.
