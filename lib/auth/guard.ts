import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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
// Dev user for AUTH_DISABLED mode.
// Uses a fixed UUID so all dev data belongs to the same user.
// ---------------------------------------------------------------------------
const DEV_USER: AuthSuccess = {
  userId: "00000000-0000-0000-0000-000000000000",
  email: "dev@localhost",
};

let devUserSeeded = false;

async function ensureDevUser() {
  if (devUserSeeded) return;
  await db
    .insert(users)
    .values({ id: DEV_USER.userId, email: DEV_USER.email, name: "Dev User" })
    .onConflictDoNothing();
  devUserSeeded = true;
}

// ---------------------------------------------------------------------------
// requireAuth()
//
// Reusable helper for Server Actions. Call as the first line of every action.
// Returns { userId, email } on success or { error } on failure.
// No properties overlap between success and error — this is a proper
// discriminated union consistent with the existing Server Action pattern.
// ---------------------------------------------------------------------------

export async function requireAuth(): Promise<AuthResult> {
  // Dev mode: skip auth entirely when AUTH_DISABLED is set
  if (process.env.AUTH_DISABLED === "true") {
    await ensureDevUser();
    return DEV_USER;
  }

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
