import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { and, eq, isNull } from "drizzle-orm";
import { db, lktOrganizations, lktMemberships, lktWorkspaces, lktAiUsage } from "@workspace/db";
import {
  GetLktAccountResponse, CreateLktOrganizationBody, CreateLktOrganizationResponse,
  DeleteLktOrganizationParams, GetLktMembersResponse, AddLktMemberBody, AddLktMemberResponse, RemoveLktMemberParams,
} from "@workspace/api-zod";
import { legacyWorkspaceId, requireLktOrganization, requireLktOwner } from "../lib/lkt-auth";
import { defaultProfile } from "../lib/lkt-workspace";
import { assertMembership, assertNoConsultation, LktAccessError, lockOrganization } from "../lib/lkt-ai-limits";

const router: IRouter = Router();
const clearLegacy = (res: import("express").Response) => res.clearCookie("lkt_workspace", { path: "/api/lkt" });

router.get("/lkt/account", async (req, res): Promise<void> => {
  const organizations = await db.select({
    id: lktOrganizations.id, name: lktOrganizations.name, role: lktMemberships.role,
  }).from(lktMemberships).innerJoin(lktOrganizations, eq(lktMemberships.organizationId, lktOrganizations.id))
    .where(eq(lktMemberships.userId, res.locals.userId)).orderBy(lktOrganizations.createdAt);
  const legacyId = legacyWorkspaceId(req);
  const legacy = legacyId ? await db.select({ id: lktWorkspaces.id }).from(lktWorkspaces)
    .where(and(eq(lktWorkspaces.id, legacyId), isNull(lktWorkspaces.organizationId))) : [];
  res.json(GetLktAccountResponse.parse({ userId: res.locals.userId, organizations, legacyAvailable: legacy.length > 0 }));
});

router.post("/lkt/organizations", async (req, res): Promise<void> => {
  const body = CreateLktOrganizationBody.safeParse(req.body);
  if (!body.success || !body.data.name.trim()) { res.status(400).json({ error: "Nama perusahaan tidak valid." }); return; }
  const legacyId = legacyWorkspaceId(req);
  if (body.data.importLegacy && (!body.data.confirmLegacyOwnership || !legacyId)) {
    res.status(400).json({ error: "Konfirmasi kepemilikan data browser lama diperlukan." }); return;
  }
  const organization = { id: randomUUID(), name: body.data.name.trim(), role: "owner" as const };
  await db.transaction(async tx => {
    await tx.insert(lktOrganizations).values({ id: organization.id, name: organization.name });
    await tx.insert(lktMemberships).values({ organizationId: organization.id, userId: res.locals.userId, role: "owner" });
    if (body.data.importLegacy) {
      // Cookie possession + explicit ownership attestation only; never attach to
      // an existing/shared company and never disclose the old content beforehand.
      const [legacy] = await tx.select().from(lktWorkspaces).where(and(
        eq(lktWorkspaces.id, legacyId!), isNull(lktWorkspaces.organizationId),
      )).for("update");
      if (!legacy) throw new LktAccessError(409, "Data lama sudah dipindahkan atau tidak tersedia. Muat ulang.");
      await tx.update(lktWorkspaces).set({ organizationId: organization.id }).where(eq(lktWorkspaces.id, legacy.id));
    } else {
      await tx.insert(lktWorkspaces).values({
        id: randomUUID(), organizationId: organization.id, profile: { ...defaultProfile, name: organization.name },
      });
    }
  });
  if (body.data.importLegacy) clearLegacy(res);
  res.status(201).json(CreateLktOrganizationResponse.parse(organization));
});

router.delete("/lkt/legacy", async (req, res): Promise<void> => {
  const id = legacyWorkspaceId(req);
  if (id) await db.delete(lktWorkspaces).where(and(eq(lktWorkspaces.id, id), isNull(lktWorkspaces.organizationId)));
  clearLegacy(res);
  res.sendStatus(204);
});

router.delete("/lkt/organizations/:id", async (req, res): Promise<void> => {
  const params = DeleteLktOrganizationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Perusahaan tidak valid." }); return; }
  await db.transaction(async tx => {
    await lockOrganization(tx, params.data.id);
    await assertMembership(tx, params.data.id, res.locals.userId, true);
    await assertNoConsultation(tx, params.data.id);
    await tx.delete(lktOrganizations).where(eq(lktOrganizations.id, params.data.id));
    await tx.delete(lktAiUsage).where(eq(lktAiUsage.key, `organization:${params.data.id}`));
  });
  res.sendStatus(204);
});

router.get("/lkt/members", requireLktOrganization, async (_req, res): Promise<void> => {
  const rows = await db.select({ userId: lktMemberships.userId, role: lktMemberships.role })
    .from(lktMemberships).where(eq(lktMemberships.organizationId, res.locals.organizationId));
  res.json(GetLktMembersResponse.parse(rows));
});
router.post("/lkt/members", requireLktOrganization, requireLktOwner, async (req, res): Promise<void> => {
  const body = AddLktMemberBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "ID akun anggota tidak valid." }); return; }
  try {
    const user = await clerkClient.users.getUser(body.data.userId);
    if (!user.emailAddresses.some(email => email.verification?.status === "verified")) {
      res.status(400).json({ error: "Anggota perlu memverifikasi email akun terlebih dahulu." }); return;
    }
  } catch {
    res.status(400).json({ error: "Akun anggota tidak dapat dikonfirmasi. Periksa ID akun atau coba lagi." }); return;
  }
  await db.transaction(async tx => {
    await lockOrganization(tx, res.locals.organizationId);
    await assertMembership(tx, res.locals.organizationId, res.locals.userId, true);
    await tx.insert(lktMemberships).values({
      organizationId: res.locals.organizationId, userId: body.data.userId, role: "member",
    }).onConflictDoNothing();
  });
  const [member] = await db.select().from(lktMemberships).where(and(
    eq(lktMemberships.organizationId, res.locals.organizationId), eq(lktMemberships.userId, body.data.userId),
  ));
  res.status(201).json(AddLktMemberResponse.parse(member));
});
router.delete("/lkt/members/:userId", requireLktOrganization, requireLktOwner, async (req, res): Promise<void> => {
  const params = RemoveLktMemberParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "ID akun tidak valid." }); return; }
  await db.transaction(async tx => {
    await lockOrganization(tx, res.locals.organizationId);
    await assertMembership(tx, res.locals.organizationId, res.locals.userId, true);
    await tx.delete(lktMemberships).where(and(
      eq(lktMemberships.organizationId, res.locals.organizationId),
      eq(lktMemberships.userId, params.data.userId), eq(lktMemberships.role, "member"),
    ));
  });
  res.sendStatus(204);
});
export default router;
