import { auth } from "@/auth";

export default auth((req) => {
  // API routes self-authorize (incl. cron). Only guard pages here.
  if (!req.auth && !req.nextUrl.pathname.startsWith("/signin")) {
    const url = new URL("/signin", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

// Run on everything except API, static assets, and the sign-in page.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|signin).*)"],
};
