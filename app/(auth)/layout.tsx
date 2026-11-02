import type { LucideIcon } from "lucide-react";
import { BrainCircuit, ScrollText, Share2 } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: BrainCircuit,
    title: "AI Architecture Generation",
    description: "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: Share2,
    title: "Real-time Collaboration",
    description: "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: ScrollText,
    title: "Instant Spec Generation",
    description: "Export a complete Markdown technical spec directly from the canvas graph.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen bg-base lg:grid-cols-2">
      <aside className="hidden flex-col justify-between border-r border-surface-border bg-surface p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-primary-foreground">
            G
          </div>
          <span className="text-sm font-semibold text-copy-primary">Ghost AI</span>
        </div>

        <div>
          <h1 className="max-w-sm text-4xl leading-tight font-bold tracking-tight text-copy-primary">
            Design systems at the speed of thought.
          </h1>
          <p className="mt-5 max-w-sm leading-relaxed text-copy-secondary">
            Describe your architecture in plain English. Ghost AI maps it to a shared canvas your
            whole team can refine in real time.
          </p>
          <ul className="mt-12 space-y-6">
            {features.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-dim">
                  <Icon className="h-4 w-4 text-brand" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-copy-primary">{title}</p>
                  <p className="mt-1 text-sm text-copy-muted">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Hardcoded: new Date() during prerender is disallowed under Cache Components. */}
        <p className="text-xs text-copy-faint">© 2026 Ghost AI. All rights reserved.</p>
      </aside>

      <main className="flex items-center justify-center p-4">{children}</main>
    </div>
  );
}
