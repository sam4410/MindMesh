Add six labeled starter templates that cover the main cloud, industry, and project-type segments.

## Implementation

1. Organize template files.
   - move templates into `components/editor/templates/`, one file per template, plus `index.ts` exporting `CANVAS_TEMPLATES`
   - move the `node()` and `edge()` helpers into `components/editor/templates/helpers.ts`; `starter-templates.ts` re-exports `CanvasTemplate` and `CANVAS_TEMPLATES` so existing imports keep working
   - lay nodes out on the AI grid (`GRID` in `lib/design-actions.ts`: 280px columns, 160px rows) so templates and AI designs look consistent

2. Add these templates, each with labels and, where a cloud is set, `service` IDs from `lib/cloud-services.ts`:
   - **Azure microservices e-commerce** (`azure`, `microservices`, `ecommerce`, `backend-platform`): Front Door, API Management, Catalog / Cart / Order / Payment services on Container Apps, Cosmos DB for catalog, Azure SQL for orders, Azure Cache for Redis, Service Bus, Key Vault, Monitor
   - **AWS serverless SaaS API** (`aws`, `serverless`, `saas`, `backend-platform`): CloudFront, API Gateway, Cognito, Lambda functions per domain, DynamoDB tables, SQS, S3, CloudWatch
   - **GCP data warehouse** (`gcp`, no architecture style, `general`, `data-warehouse`): operational sources, Pub/Sub ingestion, Cloud Storage raw zone, Dataflow transforms, BigQuery warehouse, Looker BI, Cloud Monitoring
   - **Payments platform** (`agnostic`, `event-driven`, `finance`, `backend-platform`): API gateway, payment service inside a labeled PCI zone, tokenization vault, fraud check, ledger DB, audit log store, event bus, notification service
   - **Patient records system** (`agnostic`, `modular-monolith`, `healthcare`, `backend-platform`): web/mobile clients, API, records module, consent module, PHI database (isolated), audit log, identity provider, backups
   - **ML platform** (`aws`, `microservices`, `general`, `ml-platform`): data lake (S3), feature store, training jobs, model registry, model serving endpoint, monitoring
   - every edge has a short label describing the interaction; colors follow the role rules used by the AI (services blue, data stores green, queues orange, security purple)

## Scope Limits

- don't change the gallery UI, filters, or import behavior
- don't add user-saved templates
- keep each template between 8 and 15 nodes

## Check When Done

- Nine templates appear in the gallery with correct labels.
- Filtering by Azure, finance, or data warehouse shows the matching templates.
- Each template previews and imports cleanly, with provider badges on cloud nodes.
- `npm run build` passes.
