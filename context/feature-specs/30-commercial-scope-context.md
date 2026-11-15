Update the context files so the commercial roadmap (specs 30–67) is in scope before any of it is implemented. This unit changes documentation only.

## Implementation

1. Update `context/project-overview.md`.
   - move these from Out Of Scope to In Scope:
     - billing and subscription plans
     - organization workspaces with owner, admin, and member roles
     - versioned canvas history
   - keep mobile-native applications out of scope
   - add a `### Commercial Features` section under Features with one line per group:
     - Organizations, billing, and plan limits
     - Design context segmentation (cloud provider, architecture style, industry, project type)
     - Exports and AI architecture review
     - Team workflow and integrations (comments, versions, approvals, decision records, Atlassian, GitHub)
     - Cost estimates and infrastructure-as-code generation
   - add matching success criteria, e.g. "An organization can subscribe to a paid plan and AI usage is limited by plan"

2. Update `context/architecture-context.md`.
   - Stack table: add `Billing | Stripe | Subscriptions, checkout, customer portal` and `Monitoring | Sentry | Error reporting`
   - Storage Model: add the new Blob paths
     - `versions/{projectId}/{versionId}.json` for saved canvas versions
     - `iac/{projectId}/{bundleId}.zip` for generated infrastructure code
   - Auth and Collaboration Model: projects can belong to a Clerk organization; organization members can access organization projects; roles are owner, admin, member, collaborator
   - add invariants:
     - plan limits are enforced server-side before any AI task is triggered
     - integration credentials are encrypted at rest and never returned to the client
     - design context is read from the project record on the server, never trusted from the client
     - external API calls made in request handlers must be short; anything AI-driven runs in Trigger.dev

3. Update `context/progress-tracker.md`.
   - add a `## Roadmap` section listing specs 30–67 grouped by phase, each marked `Not started`
     - Phase 1 Production readiness: 30–39
     - Phase 2 Segmentation and ease of use: 40–49
     - Phase 3 Exports and review: 50–53
     - Phase 4 Team workflow and integrations: 54–63
     - Phase 5 Cost and infrastructure code: 64–67

## Scope Limits

- don't change any code, schema, or configuration
- don't rewrite existing sections beyond the items listed
- don't mark any roadmap spec as started

## Check When Done

- `project-overview.md` lists the commercial features as in scope.
- `architecture-context.md` includes Stripe, Sentry, the new Blob paths, roles, and the new invariants.
- `progress-tracker.md` has the roadmap section with specs 30–67.
- No code files changed.
