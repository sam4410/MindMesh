Make generated specs reflect the project's design context: cloud services, compliance for regulated industries, and sections specific to the project type.

## Implementation

1. Pass the context from the server.
   - in `POST /api/ai/spec`, read the design context from the project (never from the request body) and add `designContext` to the task payload
   - extend `generateSpecPayloadSchema` in `types/tasks.ts` with `designContext: designContextSchema`

2. Add context-driven sections in `trigger/generate-spec.ts`.
   - keep the existing fixed sections and their order
   - add these sections only when they apply:
     - **Context** line at the top: `formatDesignContext(ctx)`, when any field is set
     - **Cloud services** (when the provider is AWS, Azure, or GCP): a table of component → managed service → why it was chosen, using node `service` values where present
     - **Compliance and data protection** (finance, healthcare, public-sector): the relevant frameworks (finance: PCI-DSS, SOC 2; healthcare: HIPAA; public-sector: data residency and accessibility), which components are in scope, and the required controls (encryption, audit logging, access control, retention)
     - **Data pipeline** (data-warehouse): sources, ingestion frequency, transformation layers, data quality checks
     - **Model lifecycle** (ml-platform): training, evaluation, registry, deployment, monitoring and drift
     - **Deployment pipeline** (cicd-pipeline): stages, environments, approvals, rollback
   - build the extra instructions with a small helper (e.g. `buildSpecContextSections(ctx)`) so the prompt stays readable
   - tell the model not to invent certifications the design doesn't support; it lists required controls, not compliance claims

## Scope Limits

- don't change the Specs tab UI
- don't change spec storage, filenames, or download
- don't change the AI model

## Check When Done

- A spec for a project with no context is unchanged in structure.
- An Azure finance project's spec includes the Context line, a Cloud services table, and a Compliance section mentioning PCI-DSS.
- A data warehouse project's spec includes the Data pipeline section.
- `npm run build` passes and `trigger dev` picks up the change.
