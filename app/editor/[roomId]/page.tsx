import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AccessDenied } from "@/components/editor/access-denied";
import { CollaborativeCanvas } from "@/components/editor/collaborative-canvas";
import { getAccessibleProject, getCurrentIdentity } from "@/lib/project-access";

type Props = PageProps<"/editor/[roomId]">;

// The session read can't be prerendered, so it streams behind Suspense to keep room switches instant.
export default function WorkspacePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="h-full bg-base" />}>
      <Workspace params={params} />
    </Suspense>
  );
}

async function Workspace({ params }: Pick<Props, "params">) {
  const { roomId } = await params;

  const identity = await getCurrentIdentity();
  if (!identity) redirect(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL!);

  // Missing and unauthorized projects look the same, so room IDs can't be probed.
  const project = await getAccessibleProject(roomId, identity);
  if (!project) return <AccessDenied />;

  return <CollaborativeCanvas roomId={project.id} />;
}
