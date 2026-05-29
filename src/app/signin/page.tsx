import { signIn } from "@/auth";

export default function SignIn() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <h1 style={{ marginBottom: 16 }}>Investment Dashboard</h1>
        <button
          type="submit"
          style={{ padding: "10px 20px", fontSize: 16, borderRadius: 8, cursor: "pointer" }}
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
