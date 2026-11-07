import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { and, eq } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktReportCycles } from "@workspace/db";
import { CreateReportFindingResponse, UpdateReportFindingResponse, GetReportFindingsResponse, GetReportFindingHistoryResponse, type ReportFindingInput } from "@workspace/api-zod";
import { requireLktAccount, requireLktOrganization } from "./lkt-auth";
import { findingValidationError, validFindingDate } from "./lkt-report-findings";
import findingRouter from "../routes/lkt-report-findings";

const input: ReportFindingInput = {
  title: "Selisih rekonsiliasi", problem: "Dokumen transaksi belum lengkap", cause: "Menunggu klarifikasi",
  evidenceNeeded: "Daftar transaksi pendukung tanpa data rekening", actionPlan: "Minta dokumen ke pemegang berkas",
  actionResult: "", assignee: "Tim Akuntansi", targetDate: "2025-04-30", priority: "tinggi",
  status: "terbuka", reviewNote: "", sourceDiagnosisId: "bank",
};
test("calendar dates and closure are validated without claiming compliance", () => {
  for (const day of [null, "2024-02-29", "2025-04-30"]) assert.equal(validFindingDate(day), true);
  for (const day of ["2025-02-29", "2025-04-31", "2025-13-01", "0000-01-01", "2025-01-01T00:00:00Z"]) assert.equal(validFindingDate(day), false);
  assert.ok(findingValidationError({ ...input, title: " " }));
  assert.ok(findingValidationError({ ...input, status: "ditutup", actionResult: " ", reviewNote: "Ditinjau" }));
  assert.ok(findingValidationError({ ...input, status: "ditutup", actionResult: "Sudah", reviewNote: "" }));
  assert.equal(findingValidationError({ ...input, status: "ditutup", actionResult: "Bukti disiapkan", reviewNote: "Ditelaah internal" }), null);
});

test("internal findings persist by cycle with atomic history, revision conflicts and company isolation", async t => {
  const schema = `findings_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
  const setSchema = (client: { query: (sql: string) => unknown }) => { void client.query(`SET search_path TO "${schema}"`); };
  pool.on("connect", setSchema);
  await connection.query(`
    CREATE TABLE lkt_organizations (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_memberships (organization_id text NOT NULL, user_id text NOT NULL, role text NOT NULL, PRIMARY KEY(organization_id,user_id));
    CREATE TABLE lkt_workspaces (id text PRIMARY KEY, organization_id text UNIQUE, profile jsonb NOT NULL,
      tasks jsonb NOT NULL DEFAULT '{}', bookmarks jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
  `);
  for (const name of ["lkt-report-cycles", "lkt-report-findings"]) {
    await connection.query(await readFile(new URL(`../../../../lib/db/migrations/${name}.sql`, import.meta.url), "utf8"));
  }
  connection.release();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { auth: Object.assign(() => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
      { [Symbol.for("@clerk/express.auth")]: true }) });
    next();
  });
  app.use("/api", requireLktAccount, requireLktOrganization, async (req, _res, next) => {
    if (req.get("test-revoke") === "yes") await db.delete(lktMemberships).where(and(
      eq(lktMemberships.organizationId, "org"), eq(lktMemberships.userId, "member"),
    ));
    next();
  }, findingRouter);
  app.use(((err, _req, res, _next) => { res.status(500).json({ error: err.message }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = async (path = "", method = "GET", body?: unknown, cycle = "cycle25", org = "org", user: string | null = "owner", extra = {}) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/lkt/report-cycles/${cycle}/findings${path}`, {
      method, headers: { "X-LKT-Organization": org, ...(user ? { "test-user": user } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  const profile = { name: "Fixture", kind: "nonpublik" as const, year: 2026, standard: "Belum ditentukan" as const };
  const tasks = { "2025:bank": { status: "belum" as const, notes: "Catatan asli" } };
  try {
    await db.insert(lktOrganizations).values([{ id: "org", name: "Fixture A" }, { id: "other", name: "Fixture B" }]);
    await db.insert(lktMemberships).values([
      { organizationId: "org", userId: "owner", role: "owner" }, { organizationId: "org", userId: "member", role: "member" },
      { organizationId: "other", userId: "outsider", role: "owner" },
    ]);
    await db.insert(lktWorkspaces).values([
      { id: "ws", organizationId: "org", profile, tasks }, { id: "other-ws", organizationId: "other", profile, tasks: {} },
    ]);
    const cycleBase = { kind: "nonpublik" as const, standard: "Belum ditentukan" as const, legalForm: "belum_ditentukan" as const };
    await db.insert(lktReportCycles).values([
      { ...cycleBase, id: "cycle25", workspaceId: "ws", year: 2025 },
      { ...cycleBase, id: "cycle26", workspaceId: "ws", year: 2026 },
      { ...cycleBase, id: "other-cycle", workspaceId: "other-ws", year: 2025 },
    ]);
    await t.test("account, membership and same-origin writes are required", async () => {
      assert.equal((await call("", "GET", undefined, "cycle25", "org", null)).status, 401);
      assert.equal((await call("", "GET", undefined, "cycle25", "org", "outsider")).status, 403);
      assert.equal((await call("", "POST", input, "cycle25", "org", "owner", { origin: "https://evil.example" })).status, 403);
      assert.equal((await call("", "POST", { ...input, reportCycleId: "other-cycle" })).status, 400);
      assert.equal((await call("", "POST", { ...input, targetDate: "2025-02-30" })).status, 400);
      assert.equal((await call("", "POST", { ...input, title: " " })).status, 400);
      assert.deepEqual((await call()).data, []);
    });
    const created = await call("", "POST", input);
    assert.equal(created.status, 201);
    let current = CreateReportFindingResponse.parse(created.data);
    const id = current.id;
    const update = (patch = {}) => {
      const { sourceDiagnosisId: _source, ...fields } = input;
      return {
        ...fields, title: current.title, problem: current.problem, targetDate: current.targetDate,
        actionPlan: current.actionPlan, actionResult: current.actionResult, status: current.status,
        reviewNote: current.reviewNote, archived: current.archived, expectedRevision: current.revision, ...patch,
      };
    };
    const load = async () => GetReportFindingsResponse.parse((await call()).data).find(f => f.id === id)!;
    const history = async () => GetReportFindingHistoryResponse.parse((await call(`/${id}/history`)).data);
    await t.test("calendar string round-trips and company/year boundaries are enforced", async () => {
      assert.equal(current.targetDate, "2025-04-30");
      assert.deepEqual(await load(), current);
      assert.deepEqual((await call("", "GET", undefined, "cycle26")).data, []);
      assert.equal((await call("", "GET", undefined, "cycle25", "other", "outsider")).status, 404);
      for (const path of [`/${id}`, `/${id}/history`]) {
        const method = path.endsWith("history") ? "GET" : "PUT";
        assert.equal((await call(path, method, method === "PUT" ? update() : undefined, "cycle26")).status, 404);
        assert.equal((await call(path, method, method === "PUT" ? update() : undefined, "other-cycle", "other", "outsider")).status, 404);
      }
      assert.equal((await history()).length, 1);
      assert.equal((await history())[0].actorUserId, "owner");
    });
    await t.test("members can edit, clear dates, and concurrent writers cannot overwrite", async () => {
      const result = await call(`/${id}`, "PUT", update({ targetDate: null, actionPlan: "Konfirmasi bukti", status: "proses" }), "cycle25", "org", "member");
      assert.equal(result.status, 200);
      current = UpdateReportFindingResponse.parse(result.data);
      assert.equal((await load()).targetDate, null);
      assert.equal((await call(`/${id}`, "PUT", update({ expectedRevision: 1, title: "Stale" }))).status, 409);
      const concurrent = await Promise.all([
        call(`/${id}`, "PUT", update({ cause: "Penyebab A" })),
        call(`/${id}`, "PUT", update({ cause: "Penyebab B" })),
      ]);
      assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
      current = await load();
      assert.equal(current.revision, 3);
      assert.equal((await history()).length, 3);
    });
    await t.test("closure requires evidence of action and internal review; reopening keeps prior history", async () => {
      assert.equal((await call(`/${id}`, "PUT", update({ status: "ditutup", actionResult: "", reviewNote: "" }))).status, 400);
      const closed = await call(`/${id}`, "PUT", update({ status: "ditutup", actionResult: "Dokumen diterima", reviewNote: "Diperiksa internal; bukan audit" }), "cycle25", "org", "member");
      assert.equal(closed.status, 200);
      current = UpdateReportFindingResponse.parse(closed.data);
      assert.equal(current.closedByUserId, "member");
      assert.ok(current.closedAt);
      const reopened = await call(`/${id}`, "PUT", update({ status: "terbuka" }));
      assert.equal(reopened.status, 200);
      current = UpdateReportFindingResponse.parse(reopened.data);
      assert.equal(current.closedAt, null);
      assert.equal(current.closedByUserId, null);
      assert.equal((await history()).find(e => e.revision === 4)!.snapshot.status, "ditutup");
    });
    await t.test("archive/restore retain history and never change profile, checklist or other years", async () => {
      const archived = await call(`/${id}`, "PUT", update({ archived: true }));
      assert.equal(archived.status, 200); current = UpdateReportFindingResponse.parse(archived.data);
      assert.equal((await load()).archived, true);
      const restored = await call(`/${id}`, "PUT", update({ archived: false }));
      assert.equal(restored.status, 200); current = UpdateReportFindingResponse.parse(restored.data);
      assert.equal((await load()).archived, false);
      const events = await history();
      assert.equal(events.length, 7);
      assert.equal(events.at(-1)!.snapshot.targetDate, "2025-04-30");
      assert.equal(events.find(e => e.revision === 2)!.snapshot.targetDate, null);
      const [stored] = await db.select().from(lktWorkspaces).where(eq(lktWorkspaces.id, "ws"));
      assert.deepEqual(stored.profile, profile);
      assert.deepEqual(stored.tasks, tasks);
      assert.deepEqual((await call("", "GET", undefined, "cycle26")).data, []);
    });
    await t.test("failed history writes roll back the finding update", async () => {
      await pool.query(`CREATE FUNCTION reject_finding_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture journal unavailable'; END; $$;
        CREATE TRIGGER reject_event BEFORE INSERT ON lkt_report_finding_events FOR EACH ROW EXECUTE FUNCTION reject_finding_event();`);
      assert.equal((await call(`/${id}`, "PUT", update({ title: "Must roll back" }))).status, 500);
      assert.deepEqual(await load(), current);
      assert.equal((await history()).length, 7);
      await pool.query("DROP TRIGGER reject_event ON lkt_report_finding_events");
    });
    await t.test("revocation between middleware and commit prevents changes", async () => {
      assert.equal((await call(`/${id}`, "PUT", update({ title: "Revoked writer" }), "cycle25", "org", "member", { "test-revoke": "yes" })).status, 403);
      assert.deepEqual(await load(), current);
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    pool.removeListener("connect", setSchema);
    await pool.end();
  }
});
