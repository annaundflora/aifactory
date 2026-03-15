import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { users, accounts, sessions } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Startup-time env validation (Finding 1 + 2)
// Throws descriptive errors at import time if required env vars are missing.
// ---------------------------------------------------------------------------
function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `[auth] Missing required environment variable: ${name}. ` +
        `Set it in your .env file or environment before starting the server.`
    );
  }
  return value;
}

assertEnv("AUTH_SECRET");
assertEnv("AUTH_GOOGLE_ID");
assertEnv("AUTH_GOOGLE_SECRET");

/**
 * Parse the ALLOWED_EMAILS env var into a lowercase, trimmed array.
 * Used in the signIn callback to restrict access to allowed users only.
 *
 * Throws at startup if ALLOWED_EMAILS is unset or empty — at least one
 * allowed email is required per architecture (Validation Rules).
 */
function getAllowedEmails(): string[] {
  const raw = assertEnv("ALLOWED_EMAILS");
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (emails.length === 0) {
    throw new Error(
      "[auth] ALLOWED_EMAILS is set but contains no valid email addresses. " +
        "Provide at least one comma-separated email."
    );
  }

  return emails;
}

// Eagerly validate at startup so the server fails fast if misconfigured.
const allowedEmails = getAllowedEmails();

export const { auth, handlers, signIn, signOut } = NextAuth({
  // NOTE: Auth.js tables (users, accounts, sessions) are created in Slice 04.
  // Until that migration runs, database sessions will not be functional.
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: {
    strategy: "database",
  },
  pages: {
    // Login page UI is created in Slice 02.
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ user, account }) {
      // Defense-in-depth: only allow Google provider sign-ins
      if (account?.provider !== "google") return false;

      const email = user.email;
      if (!email) return false;

      console.log("[auth] signIn attempt:", email, "| allowed:", allowedEmails);
      return allowedEmails.includes(email.toLowerCase());
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
