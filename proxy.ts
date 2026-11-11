import { clerkMiddleware } from "@clerk/nextjs/server";

const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;

// Without these, the sign-in page itself would be protected and redirect to itself forever.
if (!signInUrl || !signUpUrl) {
  throw new Error("NEXT_PUBLIC_CLERK_SIGN_IN_URL and NEXT_PUBLIC_CLERK_SIGN_UP_URL must be set");
}

const publicPaths = [signInUrl, signUpUrl];

function isPublicPath(pathname: string, requestUrl: URL) {
  return publicPaths.some((path) => {
    const publicPath = new URL(path, requestUrl).pathname;
    return pathname === publicPath || pathname.startsWith(`${publicPath}/`);
  });
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname, req.nextUrl)) return;

  // auth.protect() answers signed-out API calls with 404; APIs need a proper 401.
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
