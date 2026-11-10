import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
export const dynamic = "force-dynamic";
export default function SignInPage() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      {process.env.APP_MODE === "local" ? (
        <div>
          <h1>Local research workspace</h1>
          <p>
            Authentication is disabled only for this loopback development
            workspace.
          </p>
          <Link href="/">Open your library</Link>
        </div>
      ) : (
        <SignIn />
      )}
    </main>
  );
}
