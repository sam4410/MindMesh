import type { ComponentProps, ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Shared shell for editor dialogs: applies the ui-context modal styling without touching components/ui.
interface EditorDialogProps extends Pick<ComponentProps<typeof Dialog>, "open" | "onOpenChange"> {
  title: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  // Overrides the default width (sm:max-w-md), e.g. for wider content like a card grid.
  className?: string;
}

export function EditorDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
}: EditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-5 rounded-3xl border border-surface-border bg-elevated p-6 ring-0 sm:max-w-md",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-copy-primary">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-copy-muted">{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
        {footer && (
          <DialogFooter className="-mx-6 -mb-6 rounded-b-3xl border-surface-border bg-surface px-6 py-4">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
