import { LoginForm } from "./login-form";

/**
 * Login page at /login.
 *
 * Server Component that reads searchParams and passes the error
 * query parameter to the client-side LoginForm component.
 * Renders a centered card with the app name, optional error message
 * (driven by ?error= query parameter), and a Google Sign-In button.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <LoginForm error={error ?? null} />
    </div>
  );
}
