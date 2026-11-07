import { pool } from "@workspace/db";
import { changeEditorialAccess, resolveVerifiedAccount } from "../lib/lkt-operator-access";

// Infrastructure-only, explicit identity confirmation, no automatic startup grants.
const [action, email, name, confirmation, operatorName, reason] = process.argv.slice(2);
try {
  if (!["grant", "revoke"].includes(action) || !email || !name?.trim() ||
      confirmation !== "--confirm-identity" || !operatorName?.trim() || !reason?.trim()) {
    throw new Error('Usage: editorial:member <grant|revoke> <verified-email> <display-name> --confirm-identity <operator-name> <reason>. Verify the human and target environment.');
  }
  const targetUserId = await resolveVerifiedAccount(email);
  const result = await changeEditorialAccess({ source: "cli", operatorName }, {
    role: "editor", action: action as "grant" | "revoke", targetUserId, displayName: name, reason,
  });
  process.stdout.write(result.changed ? "Editorial access changed and audited; historical attribution retained.\n" : "No change; existing state retained.\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Editorial operation failed"}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
