import Link from "next/link";
export function AuthScreen({ local = false }: { local?: boolean }) {
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <h1>{local ? "Local research workspace" : "Sign in is unavailable"}</h1>
        <p>
          {local
            ? "This local workspace is ready to use without an account."
            : "Contact your workspace administrator, or retry after sign-in has been restored."}
        </p>
        {local ? (
          <Link className="button primary" href="/">
            Open your library
          </Link>
        ) : (
          <form action="/" method="get">
            <button type="submit" className="button primary">
              Retry
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
