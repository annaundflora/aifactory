"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Map known Auth.js error query-param values to user-facing messages.
 *
 * - AccessDenied: signIn callback returned false (email not in allowlist)
 * - OAuthAccountNotLinked / OAuthCallbackError: generic OAuth failure
 */
function getErrorMessage(error: string | null): string | null {
  if (!error) return null;

  switch (error) {
    case "AccessDenied":
      return "Kein Zugang. Bitte kontaktiere den Administrator.";
    case "OAuthAccountNotLinked":
    case "OAuthCallbackError":
      return "Login fehlgeschlagen. Bitte erneut versuchen.";
    default:
      return "Login fehlgeschlagen. Bitte erneut versuchen.";
  }
}

/**
 * Inner login form that reads searchParams.
 * Wrapped in Suspense because useSearchParams() requires it in Next.js App Router.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorMessage = getErrorMessage(error);

  function handleSignIn() {
    signIn("google", { redirectTo: "/" });
  }

  return (
    <Card className="w-full max-w-[400px]">
      <CardHeader className="items-center text-center">
        <CardTitle className="text-2xl font-bold" data-testid="app-name">
          AI Factory
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {errorMessage && (
          <div
            role="alert"
            data-testid="login-error"
            className="w-full rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}
        <Button
          onClick={handleSignIn}
          size="lg"
          className="w-full"
          data-testid="google-sign-in"
        >
          <GoogleIcon />
          Mit Google anmelden
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Minimal inline Google "G" icon so we do not need an external dependency.
 */
function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-5"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Login page at /login.
 *
 * Renders a centered card with the app name, optional error message
 * (driven by ?error= query parameter), and a Google Sign-In button.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-[400px]">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl font-bold">AI Factory</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Button size="lg" className="w-full" disabled>
                Mit Google anmelden
              </Button>
            </CardContent>
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
