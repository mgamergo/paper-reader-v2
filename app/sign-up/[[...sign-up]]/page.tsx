import { SignUp } from "@clerk/nextjs";
import { AuthScreen } from "@/components/auth-screen";
import { configuredWorkspaceAuth } from "@/lib/server/auth-mode";
export const dynamic = "force-dynamic";
export default function SignUpPage() {
  const mode = configuredWorkspaceAuth();
  return mode === "clerk" ? (
    <main className="auth-screen">
      <SignUp path="/sign-up" routing="path" />
    </main>
  ) : (
    <AuthScreen local={mode === "local"} />
  );
}
