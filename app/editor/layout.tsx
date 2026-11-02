import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { EditorShell } from "@/components/editor/editor-shell";
import { getCurrentIdentity } from "@/lib/project-access";
import { getProjectsForUser } from "@/lib/projects";

export default function EditorLayout({ children }: LayoutProps<"/editor">) {
  // Cache Components: reading the signed-in user is runtime data, so it renders inside Suspense.
  return (
    <Suspense fallback={<div className="h-screen bg-base" />}>
      <EditorFrame>{children}</EditorFrame>
    </Suspense>
  );
}

// Fetched here rather than in a page so the sidebar has data on every /editor screen;
// router.refresh() re-runs it after mutations.
async function EditorFrame({ children }: { children: ReactNode }) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL!);

  const { owned, shared } = await getProjectsForUser(identity.userId, identity.email);

  return (
    <EditorShell ownedProjects={owned} sharedProjects={shared}>
      {children}
    </EditorShell>
  );
}
