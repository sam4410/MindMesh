import { Lock } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AccessDenied() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <Lock className="h-8 w-8 text-copy-faint" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-copy-primary">Project unavailable</h1>
        <p className="max-w-sm text-sm text-copy-muted">
          This project doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>
      <Link href="/editor" className={cn(buttonVariants({ variant: "outline" }), "rounded-xl")}>
        Back to projects
      </Link>
    </div>
  );
}
