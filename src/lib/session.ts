import { auth } from "@/auth";
import { isAllowed } from "@/lib/auth-allowlist";

/** True only for an authenticated, allowlisted user. */
export async function isAuthorizedUser(): Promise<boolean> {
  const session = await auth();
  return isAllowed(session?.user?.email, process.env.ALLOWED_EMAIL);
}
