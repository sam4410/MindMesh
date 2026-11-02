import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function RootRedirect() {
  const { isAuthenticated } = await auth();
  return redirect(isAuthenticated ? "/editor" : process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL!);
}

export default function Home() {
  return (
    <Suspense>
      <RootRedirect />
    </Suspense>
  );
}
