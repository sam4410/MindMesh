Add the design context taxonomy: four optional labels on each project (cloud provider, architecture style, industry, project type). This unit adds the data model and API only.

## Implementation

1. Define the taxonomy in `lib/design-context.ts`.
   - each list is `readonly { id: string; label: string }[]`:
     - `CLOUD_PROVIDERS`: `aws` AWS, `azure` Azure, `gcp` Google Cloud, `agnostic` Cloud-agnostic, `on-prem` On-premises
     - `ARCHITECTURE_STYLES`: `monolith`, `modular-monolith`, `microservices`, `event-driven`, `serverless`, `data-mesh`
     - `INDUSTRIES`: `general`, `finance`, `healthcare`, `ecommerce`, `saas`, `gaming`, `public-sector`
     - `PROJECT_TYPES`: `backend-platform`, `data-warehouse`, `ml-platform`, `cicd-pipeline`, `cloud-migration`, `realtime-app`
   - export a `DesignContext` type: `{ cloudProvider: string | null; architectureStyle: string | null; industry: string | null; projectType: string | null }`
   - export `designContextSchema` (Zod): each field nullable and restricted to its list's IDs
   - export `formatDesignContext(ctx)`, e.g. `"Azure · Microservices · Finance"`, skipping null fields

2. Store it on `Project`.
   - add `cloudProvider String?`, `architectureStyle String?`, `industry String?`, `projectType String?` to `prisma/models/project.prisma`
   - store IDs as plain strings (validated in the app, not Prisma enums), so lists can grow without migrations
   - create migration `add_project_design_context`

3. Accept it in the project API.
   - extend `readProjectInput` in `lib/project-input.ts` with an optional `designContext` object validated by `designContextSchema`; unknown IDs return 400
   - `POST /api/projects` saves it when provided
   - `PATCH /api/projects/[projectId]` updates it (any role with access may change it; it describes the design, not project management)

4. Read it back on the server.
   - add the four fields to the `select` in `getAccessibleProject`
   - add `getDesignContext(project): DesignContext` in `lib/design-context.ts`

## Scope Limits

- don't build UI
- don't change AI prompts, templates, or specs
- don't make any field required

## Check When Done

- Migration adds the four nullable fields.
- `POST` and `PATCH` accept valid context and reject unknown IDs with 400.
- `getAccessibleProject` returns the context fields.
- `npm run build` passes.
