import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function RootRedirect() {
  const { isAuthenticated } = await auth();
  return redirect(isAuthenticated ? "/editor" : "/sign-in");
}

export default function Home() {
  return (
    <Suspense>
      <RootRedirect />
    </Suspense>
  );
}
