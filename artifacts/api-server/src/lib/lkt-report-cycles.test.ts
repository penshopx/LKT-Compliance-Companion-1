import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { eq } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, type LktWorkspace, type LktReportCycle } from "@workspace/db";
import { CreateReportCycleBody, GetReportCycleResponse, GetReportCyclesResponse } from "@workspace/api-zod";
import { cycleTasks, diagnoseCycle } from "./lkt-report-readiness";
import { references } from "./lkt-content";
import { requireLktAccount, requireLktOrganization } from "./lkt-auth";
import reportRouter from "../routes/lkt-report-cycles";

const input = {
  year: 2025, kind: "nonpublik" as const, standard: "Belum ditentukan" as const,
  legalForm: "belum_ditentukan" as const, coordinator: "", notes: "Fixture",
};
const workspace: LktWorkspace = {
  id: "workspace", organizationId: "org", profile: { name: "Fixture Company", kind: "nonpublik", standard: "Belum ditentukan", year: 2026 },
  tasks: { "2025:bank": { status: "selesai", notes: "Bukti tahun 2025" }, "2026:bank": { status: "proses", notes: "Catatan 2026" } },
  bookmarks: {}, createdAt: new Date(),
};
const cycle: LktReportCycle = { ...input, id: "cycle", workspaceId: workspace.id, revision: 1, createdAt: new Date(), updatedAt: new Date() };

test("diagnosis is period-specific, bounded, deterministic and never verifies sources", () => {
  const original = JSON.stringify({ references, workspace, cycle });
  const result = diagnoseCycle(cycle, workspace, references);
  assert.equal(result.report.completed, 1);
  assert.equal(result.checklist.find(t => t.id === "bank")!.notes, "Bukti tahun 2025");
  assert.ok(result.findings.some(f => f.id === "standard"));
  assert.ok(result.findings.some(f => f.id === "legal-form"));
  assert.match(result.disclaimer, /bukan tingkat kepatuhan/);
  assert.ok(!cycleTasks(cycle, workspace).some(t => t.id === "ojk"));
  assert.ok(cycleTasks({ ...cycle, kind: "publik" }, workspace).some(t => t.id === "ojk"));
  assert.ok(cycleTasks({ ...cycle, kind: "kjpp" }, workspace).some(t => t.id === "kjpp"));
  assert.equal(diagnoseCycle({ ...cycle, legalForm: "pt_perorangan" }, workspace, references).references.some(r => r.id === "kemenkum-rupst"), false);
  const done = { ...workspace, tasks: Object.fromEntries(cycleTasks(cycle, workspace).map(t =>
    [`2025:${t.id}`, { status: "selesai", notes: "" }])) };
  const complete = diagnoseCycle(cycle, done, references);
  assert.equal(complete.report.progress, 100);
  assert.match(complete.findings.find(f => f.id === "complete")!.detail, /tidak menyatakan/);
  assert.equal(JSON.stringify({ references, workspace, cycle }), original);
  assert.equal(CreateReportCycleBody.safeParse({ ...input, year: 2019 }).success, false);
});

test("report API persists year-specific work and isolates companies without changing active profile", async t => {
  const schema = `report_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
  pool.on("connect", client => { void client.query(`SET search_path TO "${schema}"`); });
  await connection.query(`
    CREATE TABLE lkt_organizations (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_memberships (organization_id text NOT NULL, user_id text NOT NULL, role text NOT NULL, PRIMARY KEY(organization_id,user_id));
    CREATE TABLE lkt_workspaces (id text PRIMARY KEY, organization_id text UNIQUE, profile jsonb NOT NULL,
      tasks jsonb NOT NULL DEFAULT '{}', bookmarks jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
  `);
  for (const name of ["lkt-editorial", "lkt-report-cycles"]) {
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
  app.use("/api", requireLktAccount, requireLktOrganization, reportRouter);
  app.use(((err, _req, res, _next) => { res.status(500).json({ error: err.message }); }) as express.ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = async (path = "", method = "GET", body?: unknown, org = "org", user: string | null = "owner", extra = {}) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/lkt/report-cycles${path}`, {
      method, headers: { "X-LKT-Organization": org, ...(user ? { "test-user": user } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    await db.insert(lktOrganizations).values([{ id: "org", name: "Fixture A" }, { id: "other", name: "Fixture B" }]);
    await db.insert(lktMemberships).values([
      { organizationId: "org", userId: "owner", role: "owner" }, { organizationId: "org", userId: "member", role: "member" },
      { organizationId: "other", userId: "outsider", role: "owner" },
    ]);
    await db.insert(lktWorkspaces).values([workspace, { ...workspace, id: "other-workspace", organizationId: "other", tasks: {} }]);
    await t.test("requires account and membership and rejects cross-site writes", async () => {
      assert.equal((await call("", "GET", undefined, "org", null)).status, 401);
      assert.equal((await call("", "GET", undefined, "org", "outsider")).status, 403);
      assert.equal((await call("", "POST", input, "org", "owner", { origin: "https://evil.example" })).status, 403);
      assert.deepEqual((await call()).data, []);
    });
    const created = await call("", "POST", input);
    assert.equal(created.status, 201);
    const report = GetReportCycleResponse.parse(created.data);
    const id = report.report.id;
    await t.test("same-year legacy work is retained, duplicates rejected, another company may create same year", async () => {
      assert.equal(report.checklist.find(t => t.id === "bank")!.notes, "Bukti tahun 2025");
      assert.equal((await call("", "POST", input)).status, 409);
      assert.equal((await call("", "POST", input, "other", "outsider")).status, 201);
      assert.equal((await call(`/${id}`, "GET", undefined, "other", "outsider")).status, 404);
      assert.equal((await call(`/${id}/tasks/bank`, "PUT", { status: "belum", notes: "" }, "other", "outsider")).status, 404);
      assert.equal((await call("", "POST", { ...input, year: 2026 })).status, 201);
    });
    await t.test("member updates selected-year task only; fresh reads agree with legacy checklist", async () => {
      const updated = await call(`/${id}/tasks/bank`, "PUT", { status: "proses", notes: "Tindak lanjut 2025" }, "org", "member");
      assert.equal(updated.status, 200);
      assert.equal(GetReportCycleResponse.parse(updated.data).report.completed, 0);
      assert.equal(GetReportCycleResponse.parse((await call(`/${id}`)).data).checklist.find(t => t.id === "bank")!.notes, "Tindak lanjut 2025");
      assert.equal((await call(`/${id}/tasks/ojk`, "PUT", { status: "selesai", notes: "" })).status, 404);
      const [stored] = await db.select().from(lktWorkspaces).where(eq(lktWorkspaces.id, workspace.id));
      assert.deepEqual(stored.profile, workspace.profile);
      assert.equal(stored.tasks["2026:bank"].notes, "Catatan 2026");
      assert.equal(stored.tasks["2025:bank"].notes, "Tindak lanjut 2025");
    });
    await t.test("settings require current revision, preserve old-scope tasks, cannot change year", async () => {
      const { year: _year, ...settings } = input;
      const updated = await call(`/${id}`, "PUT", { ...settings, expectedRevision: 1, kind: "publik", coordinator: "Tim Keuangan" });
      assert.equal(updated.status, 200);
      assert.equal(GetReportCycleResponse.parse(updated.data).report.revision, 2);
      assert.ok(GetReportCycleResponse.parse(updated.data).checklist.some(t => t.id === "ojk"));
      assert.equal((await call(`/${id}`, "PUT", { ...settings, expectedRevision: 1 })).status, 409);
      assert.equal((await call(`/${id}`, "PUT", { ...settings, expectedRevision: 2, year: 2027 })).status, 400);
      assert.equal(GetReportCyclesResponse.parse((await call()).data).length, 2);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
