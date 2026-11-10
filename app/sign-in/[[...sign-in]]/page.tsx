import { SignIn } from "@clerk/nextjs";
import { AuthScreen } from "@/components/auth-screen";
import { configuredWorkspaceAuth } from "@/lib/server/auth-mode";
export const dynamic = "force-dynamic";
export default function SignInPage() {
  const mode = configuredWorkspaceAuth();
  return mode === "clerk" ? (
    <main className="auth-screen">
      <SignIn path="/sign-in" routing="path" />
    </main>
  ) : (
    <AuthScreen local={mode === "local"} />
  );
}
