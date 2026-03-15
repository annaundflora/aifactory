import { auth } from "@/auth";

// ---------------------------------------------------------------------------
// Auth Guard — Discriminated Union Return Types
// ---------------------------------------------------------------------------

/** Successful auth: the session contained a valid userId and email. */
export type AuthSuccess = { userId: string; email: string };

/** Failed auth: no valid session, or session missing required fields. */
export type AuthError = { error: string };

/** Discriminated union returned by requireAuth(). */
export type AuthResult = AuthSuccess | AuthError;

// ---------------------------------------------------------------------------
// requireAuth()
//
// Reusable helper for Server Actions. Call as the first line of every action.
// Returns { userId, email } on success or { error } on failure.
// No properties overlap between success and error — this is a proper
// discriminated union consistent with the existing Server Action pattern.
// ---------------------------------------------------------------------------

export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();

  // No session at all (user not logged in, or session expired)
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const { id, email } = session.user;

  // Defensive: id must be a non-empty string
  if (!id) {
    return { error: "Unauthorized" };
  }

  // Defensive: email must be a non-empty string
  if (!email) {
    return { error: "Unauthorized" };
  }

  return { userId: id, email };
}
