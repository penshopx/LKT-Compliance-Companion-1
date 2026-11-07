import { clerkClient } from "@clerk/express";
import { db, pool, lktEditors } from "@workspace/db";
import { eq } from "drizzle-orm";

// Operator-only command, never an HTTP endpoint. Resolve against the current
// environment's Clerk instance; do not copy development user IDs to production.
const [action, email, name, confirmation] = process.argv.slice(2);
try {
  if (!["grant", "revoke"].includes(action) || !email || !name?.trim() || confirmation !== "--confirm-identity") {
    throw new Error("Usage: editorial:member <grant|revoke> <verified-email> <display-name> --confirm-identity. Verify the human and target environment before granting.");
  }
  const matches = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  const user = matches.data.find(candidate => candidate.emailAddresses.some(address =>
    address.emailAddress.toLowerCase() === email.toLowerCase() && address.verification?.status === "verified"));
  if (!user || matches.data.length !== 1) throw new Error("Exactly one existing account with this verified email is required; no account or role was created.");
  if (action === "grant") {
    await db.insert(lktEditors).values({ userId: user.id, displayName: name.trim() }).onConflictDoNothing();
    process.stdout.write("Editorial access granted (existing grants unchanged).\n");
  } else {
    await db.delete(lktEditors).where(eq(lktEditors.userId, user.id));
    process.stdout.write("Editorial access revoked. Journal and historical attribution retained.\n");
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Editorial member operation failed"}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
