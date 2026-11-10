import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
const isPublic = createRouteMatcher(["/sign-in(.*)"]);
const clerk = clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) await auth.protect();
});
export default process.env.APP_MODE === "local"
  ? () => NextResponse.next()
  : clerk;
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mjs)).*)",
    "/(api|trpc)(.*)",
  ],
};
