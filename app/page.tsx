import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Workspace from "@/components/workspace";
import { AuthScreen } from "@/components/auth-screen";
import { configuredWorkspaceAuth } from "@/lib/server/auth-mode";
export const dynamic = "force-dynamic";
export default async function Home() {
  const mode = configuredWorkspaceAuth();
  if (mode === "unavailable") return <AuthScreen />;
  if (mode === "clerk" && !(await auth()).userId) redirect("/sign-in");
  return <Workspace accountMenu={mode === "clerk" ? <UserButton /> : null} />;
}
