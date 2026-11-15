Make the AI architect follow the project's design context, so an "Azure · Microservices · Finance" project gets Azure services, per-service data stores, and finance controls.

## Implementation

1. Pass the context from the server.
   - in `POST /api/ai/design`, read the design context from the project returned by `getAccessibleProject` (never from the request body)
   - add `designContext: DesignContext` to the task payload and to `DesignAgentPayload` in `trigger/design-agent.ts`

2. Write the context rules in `lib/design-context-prompts.ts`.
   - `buildDesignContextRules(ctx): string` returns a "Design context" block, or an empty string when every field is null
   - **Cloud provider:** use managed service names from this mapping in node labels

     | Role | AWS | Azure | GCP |
     | --- | --- | --- | --- |
     | API gateway | API Gateway | API Management | API Gateway |
     | Container compute | ECS / EKS | Container Apps / AKS | Cloud Run / GKE |
     | Functions | Lambda | Functions | Cloud Functions |
     | Relational DB | RDS / Aurora | Azure SQL / PostgreSQL Flexible Server | Cloud SQL |
     | NoSQL DB | DynamoDB | Cosmos DB | Firestore |
     | Cache | ElastiCache | Azure Cache for Redis | Memorystore |
     | Queue | SQS | Service Bus | Pub/Sub |
     | Event stream | Kinesis / MSK | Event Hubs | Pub/Sub |
     | Object storage | S3 | Blob Storage | Cloud Storage |
     | CDN | CloudFront | Front Door | Cloud CDN |
     | Identity | Cognito | Entra ID | Identity Platform |
     | Secrets | Secrets Manager | Key Vault | Secret Manager |
     | Monitoring | CloudWatch | Monitor | Cloud Monitoring |
     | Data warehouse | Redshift | Synapse / Fabric | BigQuery |

     `agnostic` and `on-prem` keep generic names (e.g. "PostgreSQL", "Kafka", "Redis").
   - **Architecture style:** one rule paragraph each, e.g. microservices: one data store per service, no shared database, async messaging between domains; monolith: one deployable app with internal modules and a single primary database; serverless: functions plus managed services, no long-running servers
   - **Industry:** required components, e.g. finance: audit log store, encryption key management, fraud check, PCI scope boundary around payment data; healthcare: PHI data store isolated from other data, audit log, consent service; e-commerce: catalog cache, search, payment provider, order queue
   - **Project type:** what to focus the design on, e.g. data warehouse: sources → ingestion → raw storage → transformation → warehouse → BI; ML platform: feature store, training, model registry, serving, monitoring

3. Use the rules in the agent.
   - append the block to the user message in `planDesign` after the current canvas and before the request; leave `SYSTEM_PROMPT` unchanged
   - log the design context with the existing plan log

## Scope Limits

- don't change the node data schema (next spec adds service metadata)
- don't change the UI
- don't change spec generation

## Check When Done

- With no context, designs are generated exactly as before.
- The e-commerce prompt on an Azure + microservices project produces Azure service names and a data store per service.
- A finance project's design includes an audit log and key management.
- `npm run build` passes and `trigger dev` picks up the task change.
