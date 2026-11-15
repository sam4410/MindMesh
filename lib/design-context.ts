import { z } from "zod";

// The four optional labels that describe what a project designs. IDs are stored on Project as plain
// strings and validated here, so the lists can grow without a migration.
export const CLOUD_PROVIDERS = [
  { id: "aws", label: "AWS" },
  { id: "azure", label: "Azure" },
  { id: "gcp", label: "Google Cloud" },
  { id: "agnostic", label: "Cloud-agnostic" },
  { id: "on-prem", label: "On-premises" },
] as const;

export const ARCHITECTURE_STYLES = [
  { id: "monolith", label: "Monolith" },
  { id: "modular-monolith", label: "Modular monolith" },
  { id: "microservices", label: "Microservices" },
  { id: "event-driven", label: "Event-driven" },
  { id: "serverless", label: "Serverless" },
  { id: "data-mesh", label: "Data mesh" },
] as const;

export const INDUSTRIES = [
  { id: "general", label: "General" },
  { id: "finance", label: "Finance" },
  { id: "healthcare", label: "Healthcare" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "saas", label: "SaaS" },
  { id: "gaming", label: "Gaming" },
  { id: "public-sector", label: "Public sector" },
] as const;

export const PROJECT_TYPES = [
  { id: "backend-platform", label: "Backend platform" },
  { id: "data-warehouse", label: "Data warehouse" },
  { id: "ml-platform", label: "ML platform" },
  { id: "cicd-pipeline", label: "CI/CD pipeline" },
  { id: "cloud-migration", label: "Cloud migration" },
  { id: "realtime-app", label: "Real-time app" },
] as const;

export type DesignContext = {
  cloudProvider: string | null;
  architectureStyle: string | null;
  industry: string | null;
  projectType: string | null;
};

const DESIGN_CONTEXT_FIELDS = {
  cloudProvider: CLOUD_PROVIDERS,
  architectureStyle: ARCHITECTURE_STYLES,
  industry: INDUSTRIES,
  projectType: PROJECT_TYPES,
} as const;

type Option = { readonly id: string; readonly label: string };
const idEnum = (options: readonly Option[]) =>
  z.enum(options.map((option) => option.id) as [string, ...string[]]);

// Each field is restricted to its list's IDs. null clears a label; an omitted field is left unchanged
// on update (and stored as null on create).
export const designContextSchema = z.object({
  cloudProvider: idEnum(CLOUD_PROVIDERS).nullable().optional(),
  architectureStyle: idEnum(ARCHITECTURE_STYLES).nullable().optional(),
  industry: idEnum(INDUSTRIES).nullable().optional(),
  projectType: idEnum(PROJECT_TYPES).nullable().optional(),
});
export type DesignContextInput = z.infer<typeof designContextSchema>;

// The project's labels as a DesignContext; works on any object carrying the four Project columns.
export function getDesignContext(project: DesignContext): DesignContext {
  const { cloudProvider, architectureStyle, industry, projectType } = project;
  return { cloudProvider, architectureStyle, industry, projectType };
}

// Field order, labels and options for UIs that edit or show the context.
export const DESIGN_CONTEXT_FIELD_LIST = [
  { field: "cloudProvider", label: "Cloud provider", options: CLOUD_PROVIDERS },
  { field: "architectureStyle", label: "Architecture style", options: ARCHITECTURE_STYLES },
  { field: "industry", label: "Industry", options: INDUSTRIES },
  { field: "projectType", label: "Project type", options: PROJECT_TYPES },
] as const satisfies readonly { field: keyof DesignContext; label: string; options: readonly Option[] }[];

export const EMPTY_DESIGN_CONTEXT: DesignContext = {
  cloudProvider: null,
  architectureStyle: null,
  industry: null,
  projectType: null,
};

// The set labels in field order, e.g. ["Azure", "Microservices", "Finance"].
export function designContextLabels(ctx: DesignContext): string[] {
  return DESIGN_CONTEXT_FIELD_LIST.flatMap(({ field }) => {
    const options: readonly Option[] = DESIGN_CONTEXT_FIELDS[field];
    const label = options.find((option) => option.id === ctx[field])?.label;
    return label ? [label] : [];
  });
}

// e.g. "Azure · Microservices · Finance"; empty string when nothing is set.
export function formatDesignContext(ctx: DesignContext) {
  return designContextLabels(ctx).join(" · ");
}
