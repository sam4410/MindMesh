"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DESIGN_CONTEXT_FIELD_LIST, type DesignContext } from "@/lib/design-context";
import { cn } from "@/lib/utils";

interface DesignContextFieldsProps {
  value: DesignContext;
  onChange: (value: DesignContext) => void;
  disabled?: boolean;
  // Prefixes element IDs so two instances on one page don't collide.
  idPrefix: string;
  // The null choice's text: "Not set" when editing, "All" when filtering.
  emptyLabel?: string;
  // Shorter field labels, e.g. "Cloud" in the template filters.
  fieldLabels?: Partial<Record<keyof DesignContext, string>>;
  className?: string;
}

// The four design-context selects, shared by the create-project and edit dialogs and the template filters.
export function DesignContextFields({
  value,
  onChange,
  disabled,
  idPrefix,
  emptyLabel = "Not set",
  fieldLabels,
  className,
}: DesignContextFieldsProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {DESIGN_CONTEXT_FIELD_LIST.map(({ field, label: defaultLabel, options }) => {
        const id = `${idPrefix}-${field}`;
        const label = fieldLabels?.[field] ?? defaultLabel;
        // null is the empty choice; items lets the trigger show labels instead of IDs.
        const items = [{ value: null, label: emptyLabel }, ...options.map((o) => ({ value: o.id, label: o.label }))];
        return (
          <div key={field} className="space-y-1.5">
            <label htmlFor={id} className="text-xs font-medium text-copy-secondary">
              {label}
            </label>
            <Select
              items={items}
              value={value[field]}
              onValueChange={(next) => onChange({ ...value, [field]: (next as string | null) ?? null })}
              disabled={disabled}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.value ?? "none"} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
