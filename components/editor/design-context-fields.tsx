"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DESIGN_CONTEXT_FIELD_LIST, type DesignContext } from "@/lib/design-context";

interface DesignContextFieldsProps {
  value: DesignContext;
  onChange: (value: DesignContext) => void;
  disabled?: boolean;
  // Prefixes element IDs so two instances on one page don't collide.
  idPrefix: string;
}

const NOT_SET = "Not set";

// The four design-context selects, shared by the create-project and edit dialogs.
export function DesignContextFields({ value, onChange, disabled, idPrefix }: DesignContextFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DESIGN_CONTEXT_FIELD_LIST.map(({ field, label, options }) => {
        const id = `${idPrefix}-${field}`;
        // null is the "Not set" choice; items lets the trigger show labels instead of IDs.
        const items = [{ value: null, label: NOT_SET }, ...options.map((o) => ({ value: o.id, label: o.label }))];
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
