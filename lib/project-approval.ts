// Client-safe: the approval route and the navbar menu share these rules (spec 57).
import { canManageProject, type ProjectRole } from "@/lib/project-roles";

export const APPROVAL_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface ApprovalState {
  approvalStatus: ApprovalStatus;
  approvedByName: string | null;
  // ISO string; set only while APPROVED.
  approvedAt: string | null;
}

// Who may make each change: anyone with access, or only owners and admins. Anything else is a 409.
const TRANSITIONS: Record<ApprovalStatus, Partial<Record<ApprovalStatus, "anyone" | "manager">>> = {
  DRAFT: { IN_REVIEW: "anyone" },
  IN_REVIEW: { DRAFT: "anyone", APPROVED: "manager" },
  APPROVED: { DRAFT: "manager" },
};

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return APPROVAL_STATUSES.includes(value as ApprovalStatus);
}

// "invalid": not a change the workflow has; "forbidden": the role can't make it.
export function checkApprovalChange(from: ApprovalStatus, to: ApprovalStatus, role: ProjectRole) {
  const who = TRANSITIONS[from][to];
  if (!who) return "invalid" as const;
  if (who === "manager" && !canManageProject(role)) return "forbidden" as const;
  return "allowed" as const;
}

// The changes the navbar menu offers this role.
export function allowedApprovalChanges(from: ApprovalStatus, role: ProjectRole) {
  return APPROVAL_STATUSES.filter((to) => checkApprovalChange(from, to, role) === "allowed");
}
