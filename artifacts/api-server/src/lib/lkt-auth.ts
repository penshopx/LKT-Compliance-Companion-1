import type { RequestHandler, Request } from "express";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { db, lktMemberships, lktWorkspaces } from "@workspace/db";
import { getClerkProxyHost } from "../middlewares/clerkProxyMiddleware";

export const requireLktAccount: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    let sameOrigin = false;
    try { sameOrigin = !origin || new URL(origin).host === getClerkProxyHost(req); } catch { /* invalid origin is denied */ }
    if (!sameOrigin || req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Permintaan lintas situs tidak diizinkan." }); return;
    }
  }
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Masuk ke akun Anda terlebih dahulu." }); return; }
  res.locals.userId = userId;
  next();
};

export const requireLktOrganization: RequestHandler = async (req, res, next) => {
  const id = req.get("X-LKT-Organization");
  if (!id) { res.status(403).json({ error: "Pilih perusahaan yang Anda ikuti." }); return; }
  const [membership] = await db.select().from(lktMemberships).where(and(
    eq(lktMemberships.organizationId, id), eq(lktMemberships.userId, res.locals.userId),
  ));
  if (!membership) { res.status(403).json({ error: "Anda tidak memiliki akses ke perusahaan ini." }); return; }
  const [workspace] = await db.select().from(lktWorkspaces).where(eq(lktWorkspaces.organizationId, id));
  if (!workspace) { res.status(403).json({ error: "Ruang kerja perusahaan tidak tersedia." }); return; }
  res.locals.organizationId = id;
  res.locals.membership = membership;
  res.locals.workspace = workspace;
  next();
};

export const requireLktOwner: RequestHandler = (_req, res, next) => {
  if (res.locals.membership?.role !== "owner") {
    res.status(403).json({ error: "Hanya pemilik perusahaan yang dapat melakukan tindakan ini." }); return;
  }
  next();
};

export function legacyWorkspaceId(req: Request): string | undefined {
  const id = req.signedCookies?.lkt_workspace;
  return typeof id === "string" && /^[a-f0-9-]{36}$/.test(id) ? id : undefined;
}
