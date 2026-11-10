import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { configuredWorkspaceAuth } from "@/lib/server/auth-mode";
export const metadata: Metadata = {
  title: "Paper reader · Your research desk",
  description:
    "Read research papers with contextual bilingual explanations, grounded citations, and a personal glossary.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {configuredWorkspaceAuth() === "clerk" ? (
          <ClerkProvider
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
            afterSignOutUrl="/sign-in"
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
