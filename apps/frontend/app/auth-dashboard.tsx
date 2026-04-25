"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthDashboard() {
  const router = useRouter();
  const { data: session, error: sessionError, isPending } =
    authClient.useSession();
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isStartingGithubAuth, setIsStartingGithubAuth] = useState(false);

  useEffect(() => {
    if (session?.user.id) {
      router.replace("/dashboard");
    }
  }, [router, session?.user.id]);

  const signInWithGithub = async () => {
    setAuthMessage(null);
    setIsStartingGithubAuth(true);

    const result = await authClient.signIn.social({
      provider: "github",
      callbackURL: `${window.location.origin}/dashboard`,
    });

    if (result.error) {
      setAuthMessage(result.error.message ?? "GitHub sign-in failed.");
      setIsStartingGithubAuth(false);
      return;
    }

    setAuthMessage("Redirecting to GitHub...");
  };
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#e2e8f0_45%,_#cbd5e1_100%)] px-6 py-10 text-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/60 bg-slate-950 text-white shadow-[0_32px_120px_-48px_rgba(15,23,42,0.85)]">
          <div className="grid gap-8 px-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-12">
            <div className="space-y-6">
              <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Aura access control
              </span>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Frontend sessions and backend ownership are now the same
                  contract.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                  Sign in with Better Auth and land on a protected frontend
                  dashboard. The backend still owns the actual authorization
                  checks for every resource request.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Auth server</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">
                    /api/auth
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Session transport</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">
                    HttpOnly cookies
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">Protected route</p>
                  <p className="mt-2 font-mono text-sm text-slate-100">
                    /dashboard
                  </p>
                </div>
              </div>
            </div>

            <section className="rounded-[1.75rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl">
              {isPending ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
                    Session
                  </p>
                  <p className="text-sm text-slate-600">
                    Checking for an active session.
                  </p>
                </div>
              ) : session?.user ? (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-slate-500">
                      Active session
                    </p>
                    <h2 className="text-2xl font-semibold text-slate-950">
                      {session.user.name}
                    </h2>
                    <p className="text-sm text-slate-600">{session.user.email}</p>
                  </div>
                  <Link
                    className="flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    href="/dashboard"
                  >
                    Open dashboard
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-950">
                      Sign in with GitHub
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      OAuth is handled by the backend Better Auth instance, and
                      the resulting session cookie is reused for protected API
                      requests.
                    </p>
                  </div>

                  <button
                    className="flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={isStartingGithubAuth}
                    onClick={() => {
                      void signInWithGithub();
                    }}
                    type="button"
                  >
                    {isStartingGithubAuth
                      ? "Redirecting..."
                      : "Continue with GitHub"}
                  </button>
                </div>
              )}

              {authMessage ? (
                <p className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                  {authMessage}
                </p>
              ) : null}

              {sessionError ? (
                <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  Session error: {sessionError.message}
                </p>
              ) : null}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
