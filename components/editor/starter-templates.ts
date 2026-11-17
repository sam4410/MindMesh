import type { CanvasTemplate } from "@/components/editor/templates";
import type { DesignContext } from "@/lib/design-context";

// The templates live in components/editor/templates/, one file each; existing imports use this module.
export { CANVAS_TEMPLATES, type CanvasTemplate } from "@/components/editor/templates";

// True when every set filter equals the template's label for that field. A template without the
// label doesn't match, except cloud-agnostic templates match any cloud filter.
export function templateMatches(template: CanvasTemplate, filters: DesignContext) {
  return (Object.keys(filters) as (keyof DesignContext)[]).every((field) => {
    const wanted = filters[field];
    const label = template.labels[field];
    return !wanted || label === wanted || (field === "cloudProvider" && label === "agnostic");
  });
}
