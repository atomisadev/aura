"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthDashboard() {
  const router = useRouter();
  const {
    data: session,
    error: sessionError,
    isPending,
  } = authClient.useSession();
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
    <div className="flex min-h-screen items-center justify-center p-6">
      <main className="w-full max-w-4xl grid gap-12 md:grid-cols-2 items-center">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Cryptographic Audio Security.
          </h1>
          <p className="text-lg text-muted-foreground">
            Sign in to access the Aura Platform. Secure your assets with
            inaudible watermarks and verify authenticity instantly.
          </p>
        </div>

        <Card className="shadow-2xl">
          <CardHeader>
            <CardTitle>Welcome to Aura</CardTitle>
            <CardDescription>
              {isPending
                ? "Verifying secure session..."
                : session?.user
                  ? "Secure session established."
                  : "Authenticate to continue."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPending ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : session?.user ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {session.user.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Button
                  className="w-full"
                  disabled={isStartingGithubAuth}
                  onClick={() => {
                    void signInWithGithub();
                  }}
                >
                  {isStartingGithubAuth
                    ? "Redirecting..."
                    : "Continue with GitHub"}
                </Button>
              </div>
            )}

            {authMessage && (
              <p className="text-sm text-primary">{authMessage}</p>
            )}

            {sessionError && (
              <p className="text-sm text-destructive">
                Session error: {sessionError.message}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
