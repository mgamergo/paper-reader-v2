export function workspaceAuthMode(config: {
  mode?: string;
  publishableKey?: string;
  secretKey?: string;
}): "local" | "clerk" | "unavailable" {
  if (config.mode === "local") return "local";
  return config.publishableKey && config.secretKey ? "clerk" : "unavailable";
}
export function configuredWorkspaceAuth() {
  return workspaceAuthMode({
    mode: process.env.APP_MODE,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });
}
