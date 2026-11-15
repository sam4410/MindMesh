Add an approval status to projects (Draft → In review → Approved), so teams can mark a design as signed off.

## Implementation

1. Add the fields.
   - in `prisma/models/project.prisma`:
     - `approvalStatus ApprovalStatus @default(DRAFT)` with enum `ApprovalStatus { DRAFT IN_REVIEW APPROVED }`
     - `approvedById String?`, `approvedByName String?`, `approvedAt DateTime?`
   - keep the existing `status` (`DRAFT`/`ARCHIVED`) field unchanged; it is a different concept
   - create migration `add_project_approval`

2. Add `PATCH /api/projects/[projectId]/approval` with `{ status }`.
   - allowed changes, using `getProjectRole` from spec 33:

     | Change | Who |
     | --- | --- |
     | DRAFT → IN_REVIEW | anyone with access |
     | IN_REVIEW → DRAFT | anyone with access |
     | IN_REVIEW → APPROVED | owner or admin |
     | APPROVED → DRAFT | owner or admin |

   - any other change returns 409; a role that isn't allowed returns 403
   - approving sets `approvedById`, `approvedByName`, and `approvedAt`; leaving APPROVED clears them
   - return the new status fields

3. Show it in the editor.
   - a status pill in `components/editor/editor-navbar.tsx` next to the project name: "Draft", "In review", or "Approved by {name} · {date}"
   - clicking it opens a small menu with only the changes the user's role allows
   - in `components/editor/project-sidebar.tsx`, show a small colored dot per project (muted for draft, orange for in review, green for approved)
   - include the status fields in the project summary and workspace page data

## Scope Limits

- don't reset approval automatically when the canvas changes after approval
- don't add multi-person approval or approver assignment
- don't add notifications

## Check When Done

- Any member can move a project to In review and back.
- Only owners and admins can approve; others get 403.
- The navbar pill and sidebar dots reflect the status.
- `npm run build` passes.
