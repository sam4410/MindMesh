import { clerkMiddleware } from "@clerk/nextjs/server";

const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;

// Without these, the sign-in page itself would be protected and redirect to itself forever.
if (!signInUrl || !signUpUrl) {
  throw new Error("NEXT_PUBLIC_CLERK_SIGN_IN_URL and NEXT_PUBLIC_CLERK_SIGN_UP_URL must be set");
}

const publicPaths = [signInUrl, signUpUrl];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicPath(req.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
