import { pool } from "@workspace/db";
import { changeEditorialAccess, resolveVerifiedAccount } from "../lib/lkt-operator-access";

const [action, email, name, confirmation, operatorName, reason] = process.argv.slice(2);
try {
  if (!["grant", "revoke"].includes(action) || !email || !name?.trim() ||
      confirmation !== "--confirm-identity" || !operatorName?.trim() || !reason?.trim()) {
    throw new Error("Usage: editorial:operator <grant|revoke> <verified-email> <display-name> --confirm-identity <infrastructure-operator-name> <reason>. Verify target environment and human identity. This does not grant editor access.");
  }
  const targetUserId = await resolveVerifiedAccount(email);
  const result = await changeEditorialAccess({ source: "cli", operatorName }, {
    role: "operator", action: action as "grant" | "revoke", targetUserId, displayName: name, reason,
  });
  process.stdout.write(result.changed ? "Operator access changed and audited.\n" : "No change; existing state retained.\n");
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Operator operation failed"}\n`);
  process.exitCode = 1;
} finally { await pool.end(); }
