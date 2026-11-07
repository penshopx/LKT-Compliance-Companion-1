import { clerkClient } from "@clerk/express";
import { db, lktEditors, lktOperators, lktEditorialAccessEvents } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { LktAccessError } from "./lkt-ai-limits";

export async function resolveVerifiedAccount(email: string) {
  const matches = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  const user = matches.data.find(candidate => candidate.emailAddresses.some(address =>
    address.emailAddress.toLowerCase() === email.toLowerCase() && address.verification?.status === "verified"));
  if (!user || matches.data.length !== 1) {
    throw new LktAccessError(400, "Diperlukan tepat satu akun yang sudah ada dengan email terverifikasi.");
  }
  return user.id;
}

type AccessChange = {
  role: "editor" | "operator"; action: "grant" | "revoke";
  targetUserId: string; displayName: string; reason: string;
};
type Principal = { source: "panel"; userId: string } | { source: "cli"; operatorName: string };

// CLI is trusted infrastructure access, not a company-role bypass exposed over HTTP.
export async function changeEditorialAccess(principal: Principal, input: AccessChange) {
  if (!input.reason.trim() || !input.targetUserId.trim() || (input.action === "grant" && !input.displayName.trim())) {
    throw new LktAccessError(400, "Identitas dan alasan perubahan wajib diisi.");
  }
  return db.transaction(async tx => {
    // Serialize CLI and panel changes including bootstrap and concurrent no-op grants.
    await tx.execute(sql`select pg_advisory_xact_lock(6202619)`);
    let actorId: string, actorName: string;
    if (principal.source === "panel") {
      const [operator] = await tx.select().from(lktOperators).where(eq(lktOperators.userId, principal.userId)).for("share");
      if (!operator || input.role !== "editor") throw new LktAccessError(403, "Izin operator tersendiri diperlukan.");
      actorId = operator.userId;
      actorName = operator.displayName;
    } else {
      if (!principal.operatorName.trim()) throw new LktAccessError(400, "Nama operator CLI wajib diisi.");
      actorId = "infrastructure-cli";
      actorName = principal.operatorName.trim();
    }
    const table = input.role === "editor" ? lktEditors : lktOperators;
    const [existing] = await tx.select().from(table).where(eq(table.userId, input.targetUserId)).for("update");
    if ((input.action === "grant") === !!existing) return { changed: false };
    if (input.action === "grant") {
      await tx.insert(table).values({ userId: input.targetUserId, displayName: input.displayName.trim() });
    } else {
      await tx.delete(table).where(eq(table.userId, input.targetUserId));
    }
    await tx.insert(lktEditorialAccessEvents).values({
      actorId, actorName, source: principal.source, role: input.role, action: input.action,
      targetUserId: input.targetUserId, targetName: existing?.displayName ?? input.displayName.trim(),
      reason: input.reason.trim(),
    });
    return { changed: true };
  });
}
