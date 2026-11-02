import { redirect } from "next/navigation";

import { AccessDenied } from "@/components/editor/access-denied";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";

export default async function WorkspacePage({ params }: PageProps<"/editor/[roomId]">) {
  const { roomId } = await params;

  const identity = await getCurrentIdentity();
  if (!identity) redirect(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL!);

  // Missing and unauthorized projects look the same, so room IDs can't be probed.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return <AccessDenied />;

  // shortcut: placeholder until the canvas feature adds React Flow + Liveblocks.
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-base p-6 text-center">
      <p className="text-sm font-medium text-copy-secondary">{project.name}</p>
      <p className="text-sm text-copy-muted">The canvas will appear here.</p>
    </div>
  );
}
