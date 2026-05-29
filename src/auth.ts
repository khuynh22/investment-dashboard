import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowed } from "@/lib/auth-allowlist";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/signin" },
  callbacks: {
    // Only the allowlisted email may sign in.
    signIn({ profile }) {
      return isAllowed(profile?.email, process.env.ALLOWED_EMAIL);
    },
  },
});
