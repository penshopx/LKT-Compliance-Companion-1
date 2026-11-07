import { strict as assert } from "node:assert";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import express from "express";
import { eq } from "drizzle-orm";
import { db, pool, lktOrganizations, lktMemberships, lktWorkspaces, lktReferenceDigests, lktDigestDeliveries } from "@workspace/db";
import { SaveReferenceDigestBody, GetReferenceDigestResponse, type ReferenceDigestInput } from "@workspace/api-zod";
import { buildDigestText, configureReferenceDigest, digestSlot, processReferenceDigest, readReferenceDigest, runReferenceDigestTick, stopReferenceDigest, updateDigestEmailConsent } from "./lkt-reference-digest";
import { sendEmailDigest, validMailbox, type EmailDestination } from "./lkt-digest-email";
import digestEmailConsentRouter from "../routes/lkt-digest-email-consent";
import { sendSlackDigest, type SendOutcome, type SlackDestination } from "./lkt-digest-slack";
import { references } from "./lkt-content";
import { getEditorialReferences } from "./lkt-editorial";
import { LktAccessError } from "./lkt-ai-limits";
import { defaultProfile } from "./lkt-workspace";
import lktRouter from "../routes/lkt";

const destination: SlackDestination = {
  connectionId: "fixture_connection", slackTeamId: "T12345678", slackChannelId: "C12345678", recipientLabel: "#fixture · seluruh anggota kanal",
};
const resolve = async () => destination;
const input: ReferenceDigestInput = {
  channel: "slack", recipient: "C12345678", expectedRevision: 0, cadence: "daily", timeWib: "09:00", weekday: 1, topic: "all", consent: true,
};
const now = new Date("2035-01-02T02:01:00Z");

test("WIB slots, weekly boundaries, future activation and consent contract", () => {
  const config = { ...input, activatedAt: new Date("2026-11-06T00:00:00Z") };
  assert.equal(digestSlot(config, new Date("2026-11-07T01:59:59Z")), null);
  assert.equal(digestSlot(config, new Date("2026-11-07T02:00:00Z")), "2026-11-07");
  assert.equal(digestSlot({ ...config, timeWib: "00:00" }, new Date("2026-11-06T17:00:00Z")), "2026-11-07");
  assert.equal(digestSlot({ ...config, cadence: "weekly", weekday: 1 }, new Date("2026-11-07T02:00:00Z")), null);
  assert.equal(digestSlot({ ...config, cadence: "weekly", weekday: 1 }, new Date("2026-11-09T02:00:00Z")), "2026-11-09");
  assert.equal(digestSlot({ ...config, activatedAt: new Date("2026-11-07T02:00:00Z") }, new Date("2026-11-07T03:00:00Z")), null);
  for (const invalid of [{ consent: false }, { timeWib: "24:00" }, { weekday: 7 }, { recipient: "https://example.org" },
    { topic: "unknown" }, { topic: ["tax", "all"] }, { topic: null }, { topic: undefined }]) {
    assert.equal(SaveReferenceDigestBody.strict().safeParse({ ...input, ...invalid }).success, false);
  }
  const text = buildDigestText(references, "2035-01-02")!;
  assert.match(text, /bukan tenggat hukum/);
  assert.match(text, /tidak mengubah status verifikasi/);
  assert.match(text, /Berhenti berlangganan/);
  assert.equal(buildDigestText([], "2035-01-02"), null);
});

test("topics use metadata, preserve due/status criteria, ordering and the original references", () => {
  const base = { ...references[0], nextReviewAt: "2036-01-01", verificationStatus: "verified_primary" as const };
  const refs = [
    { ...base, id: "tax", title: "Tax fixture", reportType: "tax_return" as const, verificationStatus: "needs_review" as const, standards: ["Ketentuan perpajakan, bukan standar akuntansi"] },
    { ...base, id: "market", title: "Market fixture", scope: "publik", nextReviewAt: "2035-01-02" },
    { ...base, id: "sak", title: "SAK fixture", standards: ["SAK EMKM"], verificationStatus: "outdated" as const },
    { ...base, id: "later", title: "Later fixture", standards: ["SAK Entitas Privat"] },
    { ...base, id: "other", title: "Other fixture", nextReviewAt: "2034-12-31" },
  ];
  const original = structuredClone(refs);
  for (const [topic, included, excluded] of [
    ["tax", "Tax fixture", ["Market fixture", "SAK fixture", "Other fixture"]],
    ["capital_market", "Market fixture", ["Tax fixture", "SAK fixture", "Other fixture"]],
    ["accounting_standards", "SAK fixture", ["Tax fixture", "Market fixture", "Other fixture"]],
  ] as const) {
    const text = buildDigestText(refs, "2035-01-02", topic)!;
    assert.ok(text.includes(included));
    for (const title of [...excluded, "Later fixture"]) assert.ok(!text.includes(title));
    assert.match(text, /1 referensi perlu perhatian/);
  }
  const all = buildDigestText(refs, "2035-01-02", "all")!;
  for (const title of ["Tax fixture", "Market fixture", "SAK fixture", "Other fixture"]) assert.ok(all.includes(title));
  assert.ok(all.indexOf("Other fixture") < all.indexOf("Market fixture"));
  assert.equal(buildDigestText([refs[3]], "2035-01-02", "accounting_standards"), null);
  assert.equal(buildDigestText([refs[0]], "2035-01-02", "capital_market"), null);
  assert.deepEqual(refs, original);
  // Check the same classification against the actual library too.
  assert.ok(buildDigestText(references, "2035-01-02", "tax")!.includes("SPT Tahunan"));
  assert.ok(buildDigestText(references, "2035-01-02", "accounting_standards")!.includes("SAK Entitas Privat"));
  assert.ok(!buildDigestText(references, "2035-01-02", "accounting_standards")!.includes("SPT Tahunan"));
});

test("Slack acknowledgement is not HTTP success; safe and ambiguous errors are distinct", async () => {
  const run = async (body: unknown, status = 200) => sendSlackDigest(destination, "Fixture", randomUUID(), async (_name, path) =>
    new Response(JSON.stringify(path === "/auth.test" ? { ok: true, team_id: destination.slackTeamId } : body),
      { status: path === "/auth.test" ? 200 : status, headers: { "retry-after": "120" } }));
  assert.equal((await run({ ok: true, ts: "1.0001", channel: destination.slackChannelId })).status, "delivered");
  assert.equal((await run({ ok: false, error: "not_in_channel" })).status, "failed");
  assert.equal((await run({ ok: true })).status, "uncertain");
  assert.equal((await run({ ok: false, error: "internal_error" }, 503)).status, "uncertain");
  assert.deepEqual(await run({}, 429), { status: "retry", detail: "Batas Slack tercapai; percobaan ulang terjadwal.", retrySeconds: 120 });
  let posts = 0;
  const wrongTeam = await sendSlackDigest(destination, "Fixture", randomUUID(), async (_name, path) => {
    if (path === "/chat.postMessage") posts++;
    return new Response(JSON.stringify({ ok: true, team_id: "OTHER_TEAM" }));
  });
  assert.equal(wrongTeam.status, "failed");
  assert.equal(posts, 0);
  const timeout = await sendSlackDigest(destination, "Fixture", randomUUID(), async (_name, path) => {
    if (path === "/auth.test") return new Response(JSON.stringify({ ok: true, team_id: destination.slackTeamId }));
    throw new Error("Simulated timeout after submission");
  });
  assert.equal(timeout.status, "uncertain");
});

test("email mailboxes, domain preflight, provider acceptance, idempotency and ambiguous results", async () => {
  for (const invalid of ["a@b", "a\r\nbcc:x@b.com", "Name <x@example.com>", "a@example.com,b@example.com", ".a@example.com", "a..b@example.com", "a@-example.com"]) assert.equal(validMailbox(invalid), false);
  assert.equal(validMailbox("team+digest@example.com"), true);
  const email: EmailDestination = { connectionId: "fixture", sender: "digest@example.com", senderDomainId: "domain-fixture", recipient: "team@example.net" };
  let posts = 0;
  const id = randomUUID();
  let sentBody: unknown;
  const run = async (status: number, result: unknown, verified = true) => sendEmailDigest(email, "Saved body\nUnsubscribe fixture", id, async (name, path, options) => {
    assert.equal(name, "resend");
    if (path.startsWith("/domains/")) return new Response(JSON.stringify({ id: "domain-fixture", name: "example.com", status: verified ? "verified" : "pending", capabilities: { sending: "enabled" } }));
    posts++;
    assert.equal(path, "/emails");
    assert.equal((options?.headers as Record<string, string>)["Idempotency-Key"], `lkt-reference-digest/${id}`);
    if (sentBody) assert.deepEqual(options?.body, sentBody);
    sentBody = options?.body;
    if (status === 0) throw new Error("Timeout after submission");
    return new Response(JSON.stringify(result), { status, headers: { "retry-after": "120" } });
  });
  assert.equal((await run(200, { id: randomUUID() })).status, "delivered");
  const before = posts;
  assert.equal((await run(200, {}, false)).status, "failed");
  assert.equal(posts, before, "unverified domain must not send");
  assert.equal((await run(200, {})).status, "uncertain");
  assert.equal((await run(200, { id: "not-a-provider-id" })).status, "uncertain");
  assert.equal((await run(503, { name: "internal_server_error" })).status, "uncertain");
  assert.equal((await run(409, { name: "concurrent_idempotent_requests" })).status, "uncertain");
  assert.equal((await run(0, {})).status, "uncertain");
  assert.equal((await run(422, { name: "validation_error" })).status, "failed");
  assert.equal((await run(429, {})).status, "retry");
});

test("durable schedules, tenant authorization, deduplication, recovery, unsubscribe and unchanged findings", async t => {
  // Fail pool starvation instead of hanging the test process indefinitely.
  pool.options.connectionTimeoutMillis = 2_000;
  const schema = `digest_test_${randomUUID().replaceAll("-", "")}`;
  const connection = await pool.connect();
  await connection.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}"`);
  pool.on("connect", client => { void client.query(`SET search_path TO "${schema}"`); });
  await connection.query(`
    CREATE TABLE lkt_organizations (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE lkt_memberships (organization_id text NOT NULL, user_id text NOT NULL, role text NOT NULL, PRIMARY KEY(organization_id, user_id));
    CREATE TABLE lkt_workspaces (id text PRIMARY KEY, organization_id text UNIQUE, profile jsonb NOT NULL,
      tasks jsonb NOT NULL DEFAULT '{}', bookmarks jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
  `);
  await connection.query(await readFile(new URL("../../../../lib/db/migrations/lkt-editorial.sql", import.meta.url), "utf8"));
  await connection.query(await readFile(new URL("../../../../lib/db/migrations/lkt-evidence-archives.sql", import.meta.url), "utf8"));
  const migration = await readFile(new URL("../../../../lib/db/migrations/lkt-reference-digests.sql", import.meta.url), "utf8");
  // Reproduce an existing subscription before the additive topic migration.
  await connection.query(migration.split("-- Additive")[0]);
  await connection.query(`
    INSERT INTO lkt_organizations (id, name) VALUES ('fixture_legacy', 'Legacy');
    INSERT INTO lkt_reference_digests (organization_id, enabled, revision, recipient, recipient_label,
      slack_channel_id, slack_team_id, connection_id, cadence, time_wib, weekday, authorized_by)
    VALUES ('fixture_legacy', true, 7, 'C12345678', '#legacy', 'C12345678', 'T12345678', 'legacy', 'daily', '09:00', 1, 'owner');
  `);
  await connection.query(migration);
  await connection.query(migration);
  connection.release();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api", digestEmailConsentRouter);
  app.use((req, _res, next) => {
    Object.assign(req, { auth: Object.assign(() => ({ userId: req.get("test-user") ?? null, tokenType: "session_token" }),
      { [Symbol.for("@clerk/express.auth")]: true }) });
    next();
  });
  app.use("/api", lktRouter);
  app.use(((err, _req, res, _next) => {
    res.status(err instanceof LktAccessError ? err.status : 500).json({ error: err.message });
  }) as express.ErrorRequestHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(r => server.on("listening", r));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = async (org: string, user?: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) => {
    const result = await fetch(`http://127.0.0.1:${address.port}/api/lkt/reference-digest`, {
      method, headers: { "X-LKT-Organization": org, ...(user ? { "test-user": user } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined,
    });
    return { status: result.status, data: await result.json() };
  };
  const org = async (suffix: string) => {
    const id = `fixture_${suffix}`;
    await db.insert(lktOrganizations).values({ id, name: "Fixture" });
    await db.insert(lktMemberships).values([
      { organizationId: id, userId: "owner", role: "owner" }, { organizationId: id, userId: "member", role: "member" },
    ]);
    await db.insert(lktWorkspaces).values({ id: `workspace_${id}`, organizationId: id, profile: defaultProfile });
    return id;
  };
  const prepare = async (suffix: string) => {
    const id = await org(suffix);
    await configureReferenceDigest(id, "owner", input, resolve);
    return id;
  };
  let sends = 0;
  const delivered = { references: getEditorialReferences, send: async (): Promise<SendOutcome> => { sends++; return { status: "delivered", detail: null }; } };
  const original = await getEditorialReferences();
  try {
    await t.test("email stays off until recipient consent; public links are safe on GET, scoped and revocable", async () => {
      const previousOrigin = process.env.DIGEST_PUBLIC_ORIGIN;
      process.env.DIGEST_PUBLIC_ORIGIN = "https://digest-fixture.example";
      try {
        const emailInput: ReferenceDigestInput = { ...input, channel: "email", recipient: "team@example.net", sender: "digest@example.com" };
        const resolveEmail = async () => ({ ...destination, recipientLabel: emailInput.recipient, sender: emailInput.sender!, senderDomainId: "domain-fixture" });
        const id = await org("email_consent");
        const result = await configureReferenceDigest(id, "owner", emailInput, resolve, resolveEmail);
        assert.equal(result.config.channel, "email");
        assert.equal(result.config.enabled, false);
        assert.equal(result.config.recipientConfirmed, false);
        assert.equal(result.config.sender, "digest@example.com");
        assert.ok(result.consentUrl);
        assert.equal((await readReferenceDigest(id, true) as { consentUrl?: string }).consentUrl, undefined, "do not expose bearer links in general reads");
        let emailSends = 0;
        const deps = { ...delivered, sendEmail: async (): Promise<SendOutcome> => { emailSends++; return { status: "delivered", detail: "Resend accepted fixture" }; } };
        await processReferenceDigest(id, now, deps);
        assert.equal(emailSends, 0);
        const url = new URL(result.consentUrl!);
        const local = `http://127.0.0.1:${address.port}${url.pathname}${url.search}`;
        const preview = await fetch(local);
        assert.equal(preview.status, 200);
        assert.equal(preview.headers.get("cache-control"), "no-store");
        assert.match(await preview.text(), /team@example.net/);
        assert.equal((await readReferenceDigest(id, true)).config.enabled, false, "link scanners cannot activate");
        const token = url.searchParams.get("token")!;
        const publicAction = (action: string, value = token) => fetch(`http://127.0.0.1:${address.port}${url.pathname}`, {
          method: "POST", body: new URLSearchParams({ token: value, action }),
        });
        assert.equal((await publicAction("confirm", token.slice(0, -1) + (token.endsWith("0") ? "1" : "0"))).status, 400);
        assert.equal((await publicAction("confirm")).status, 200, "no account or company header required");
        assert.equal((await readReferenceDigest(id, true)).config.enabled, true);
        assert.equal((await readReferenceDigest(id, true)).config.recipientConfirmed, true);
        assert.equal((await publicAction("confirm")).status, 400, "cannot reactivate via replay");
        await processReferenceDigest(id, now, deps);
        assert.equal(emailSends, 1);
        await processReferenceDigest(id, now, deps);
        assert.equal(emailSends, 1);
        assert.equal((await readReferenceDigest(id, true)).deliveries[0].channel, "email");
        assert.equal((await publicAction("unsubscribe")).status, 200);
        assert.equal((await readReferenceDigest(id, true)).config.enabled, false);
        assert.equal((await publicAction("confirm")).status, 400, "stop invalidates consent capability");
        await processReferenceDigest(id, new Date("2035-01-03T02:01:00Z"), deps);
        assert.equal(emailSends, 1);
        const next = await configureReferenceDigest(id, "owner", { ...emailInput, expectedRevision: 3 }, resolve, resolveEmail);
        assert.equal(next.config.enabled, false, "reconfiguration requires fresh recipient consent");
        assert.notEqual(next.consentUrl, result.consentUrl);
        assert.equal((await fetch(local)).status, 400);
        await assert.rejects(configureReferenceDigest(id, "member", { ...emailInput, expectedRevision: 4 }, resolve, resolveEmail));
        await assert.rejects(configureReferenceDigest(id, "owner", { ...emailInput, expectedRevision: 3 }, resolve, resolveEmail));
        const newToken = new URL(next.consentUrl!).searchParams.get("token")!;
        await db.delete(lktMemberships).where(eq(lktMemberships.organizationId, id));
        await assert.rejects(updateDigestEmailConsent(newToken, "confirm"), /tidak lagi berwenang/);
        await updateDigestEmailConsent(newToken, "unsubscribe");
      } finally {
        if (previousOrigin === undefined) delete process.env.DIGEST_PUBLIC_ORIGIN;
        else process.env.DIGEST_PUBLIC_ORIGIN = previousOrigin;
      }
    });
    await t.test("email retries preserve body/id, unsubscribe cancels retries, ambiguity pauses without replay", async () => {
      const previousOrigin = process.env.DIGEST_PUBLIC_ORIGIN;
      process.env.DIGEST_PUBLIC_ORIGIN = "https://digest-fixture.example";
      try {
        const emailInput: ReferenceDigestInput = { ...input, channel: "email", recipient: "team@example.net", sender: "digest@example.com" };
        const resolver = async () => ({ ...destination, recipientLabel: emailInput.recipient, sender: emailInput.sender!, senderDomainId: "domain-fixture" });
        const id = await org("email_retry");
        const config = await configureReferenceDigest(id, "owner", emailInput, resolve, resolver);
        const token = new URL(config.consentUrl!).searchParams.get("token")!;
        await updateDigestEmailConsent(token, "confirm");
        const sent: { text: string; id: string }[] = [];
        const deps = { ...delivered, sendEmail: async (_d: EmailDestination, text: string, id: string): Promise<SendOutcome> => {
          sent.push({ text, id }); return { status: "retry", detail: "Rate limited", retrySeconds: 60 };
        } };
        await processReferenceDigest(id, now, deps);
        process.env.DIGEST_PUBLIC_ORIGIN = "https://changed-fixture.example";
        await processReferenceDigest(id, new Date(now.getTime() + 60_000), deps);
        assert.deepEqual(sent[0], sent[1], "origin changes must not mutate a retried email payload");
        assert.match(sent[0].text, /https:\/\/digest-fixture.example\/api\/lkt\/digest-email-consent/);
        await updateDigestEmailConsent(token, "unsubscribe");
        assert.equal((await readReferenceDigest(id, true)).deliveries[0].status, "cancelled");
        await processReferenceDigest(id, new Date(now.getTime() + 120_000), deps);
        assert.equal(sent.length, 2);
        const uncertainId = await org("email_uncertain");
        const pending = await configureReferenceDigest(uncertainId, "owner", emailInput, resolve, resolver);
        const uncertainToken = new URL(pending.consentUrl!).searchParams.get("token")!;
        await updateDigestEmailConsent(uncertainToken, "confirm");
        let attempts = 0;
        const uncertain = { ...delivered, sendEmail: async (): Promise<SendOutcome> => {
          attempts++; return { status: "uncertain", detail: "Timeout after submission" };
        } };
        await processReferenceDigest(uncertainId, now, uncertain);
        await processReferenceDigest(uncertainId, now, uncertain);
        assert.equal(attempts, 1);
        assert.equal((await readReferenceDigest(uncertainId, true)).config.enabled, false);
        await assert.rejects(updateDigestEmailConsent(uncertainToken, "confirm"), /sudah dicatat/);
        await updateDigestEmailConsent(uncertainToken, "unsubscribe");
      } finally {
        if (previousOrigin === undefined) delete process.env.DIGEST_PUBLIC_ORIGIN;
        else process.env.DIGEST_PUBLIC_ORIGIN = previousOrigin;
      }
    });
    await t.test("default is off; account, membership, owner and origin checked; no provider call", async () => {
      const id = await org("auth");
      assert.equal((await call(id)).status, 401);
      assert.equal((await call(id, "outsider")).status, 403);
      const initial = GetReferenceDigestResponse.parse((await call(id, "owner")).data);
      assert.equal(initial.config.enabled, false);
      assert.equal(initial.config.timezone, "Asia/Jakarta");
      assert.equal(initial.config.topic, "all");
      const legacy = (await readReferenceDigest("fixture_legacy", true)).config;
      assert.equal(legacy.topic, "all");
      assert.equal(legacy.enabled, true);
      assert.equal(legacy.revision, 7);
      assert.equal(GetReferenceDigestResponse.parse((await call(id, "member")).data).canManage, false);
      assert.equal((await call(id, "member", "PUT", input)).status, 403);
      assert.equal((await call(id, "member", "DELETE")).status, 403);
      assert.equal((await call(id, "owner", "PUT", { ...input, consent: false })).status, 400);
      assert.equal((await call(id, "member", "PUT", { ...input, topic: "tax" })).status, 403);
      assert.equal((await call(id, "owner", "PUT", { ...input, topic: "unknown" })).status, 400);
      assert.equal((await call(id, "owner", "PUT", { ...input, actorUserId: "outsider" })).status, 400);
      assert.equal((await call(id, "owner", "PUT", { ...input, expectedRevision: 999 })).status, 409);
      assert.equal((await call(id, "owner", "DELETE", undefined, { origin: "https://evil.example" })).status, 403);
      await processReferenceDigest(id, now, delivered);
      assert.equal(sends, 0);
      await assert.rejects(configureReferenceDigest(id, "owner", input, async () => { throw new LktAccessError(503, "Not connected"); }));
      assert.equal((await readReferenceDigest(id, true)).config.enabled, false);
      await assert.rejects(configureReferenceDigest(id, "member", input, resolve));
    });
    await t.test("configure sends nothing; concurrency and restart cannot duplicate same-day delivery", async () => {
      const id = await prepare("dedupe");
      assert.equal(sends, 0);
      const results = await Promise.allSettled([
        processReferenceDigest(id, now, delivered), processReferenceDigest(id, now, delivered),
      ]);
      assert.equal(results.filter(result => result.status === "fulfilled").length >= 1, true);
      assert.equal(sends, 1);
      await processReferenceDigest(id, now, delivered);
      assert.equal(sends, 1);
      const state = await readReferenceDigest(id, true);
      assert.equal(state.deliveries[0].status, "delivered");
      assert.equal(state.deliveries[0].attempts, 1);
      assert.equal(state.deliveries[0].day, "2035-01-02");
      await configureReferenceDigest(id, "owner", { ...input, expectedRevision: 1 }, resolve);
      await processReferenceDigest(id, now, delivered);
      assert.equal(sends, 1, "edits cannot bypass per-day deduplication");
      await assert.rejects(configureReferenceDigest(id, "owner", { ...input, expectedRevision: 1 }, resolve));
      assert.equal(GetReferenceDigestResponse.parse((await call("fixture_auth", "owner")).data).deliveries.length, 0, "other tenant history stays isolated");
    });
    await t.test("only rate limits retry, with same payload and id; bounded attempts pause schedule", async () => {
      const id = await prepare("retry");
      const sent: { text: string; id: string }[] = [];
      let reads = 0;
      const retry = { references: async () => { reads++; return reads === 1 ? original : []; }, send: async (_d: SlackDestination, text: string, deliveryId: string): Promise<SendOutcome> => {
        sent.push({ text, id: deliveryId }); return { status: "retry", detail: "Rate limited", retrySeconds: 60 };
      } };
      await processReferenceDigest(id, now, retry);
      await processReferenceDigest(id, now, retry);
      assert.equal(sent.length, 1);
      await processReferenceDigest(id, new Date(now.getTime() + 60_000), retry);
      await processReferenceDigest(id, new Date(now.getTime() + 120_000), retry);
      assert.equal(sent.length, 3);
      assert.deepEqual(sent[0], sent[1]);
      assert.deepEqual(sent[1], sent[2]);
      assert.equal(reads, 1, "retry must use the saved snapshot even after library changes");
      const state = await readReferenceDigest(id, true);
      assert.equal(state.config.enabled, false);
      assert.equal(state.deliveries[0].status, "failed");
      assert.equal(state.deliveries[0].attempts, 3);
    });
    await t.test("different team topics stay isolated; changing one cancels only its retries and keeps per-day dedupe", async () => {
      const tax = await org("topic_tax"), market = await org("topic_market");
      await configureReferenceDigest(tax, "owner", { ...input, topic: "tax" }, resolve);
      await configureReferenceDigest(market, "owner", { ...input, topic: "capital_market" }, resolve);
      assert.equal(GetReferenceDigestResponse.parse((await call(tax, "member")).data).config.topic, "tax");
      assert.equal(GetReferenceDigestResponse.parse((await call(market, "owner")).data).config.topic, "capital_market");
      assert.equal(GetReferenceDigestResponse.parse((await call("fixture_auth", "owner")).data).config.topic, "all");
      const sent = new Map<string, { text: string; id: string }[]>();
      const deps = {
        references: getEditorialReferences,
        send: async (_d: SlackDestination, text: string, id: string): Promise<SendOutcome> => {
          const topic = text.includes("Cakupan: Perpajakan") ? "tax" : "market";
          sent.set(topic, [...sent.get(topic) ?? [], { text, id }]);
          return { status: "retry", detail: "Rate limited", retrySeconds: 60 };
        },
      };
      await Promise.all([processReferenceDigest(tax, now, deps), processReferenceDigest(market, now, deps)]);
      assert.equal(sent.get("tax")!.length, 1);
      assert.equal(sent.get("market")!.length, 1);
      assert.ok(!sent.get("tax")![0].text.includes("Laporan Tahunan Emiten"));
      assert.ok(!sent.get("market")![0].text.includes("SPT Tahunan"));
      await configureReferenceDigest(tax, "owner", { ...input, expectedRevision: 1, topic: "accounting_standards" }, resolve);
      const changed = await readReferenceDigest(tax, true);
      assert.equal(changed.config.topic, "accounting_standards");
      assert.equal(changed.deliveries[0].status, "cancelled");
      const later = new Date(now.getTime() + 60_000);
      await Promise.all([processReferenceDigest(tax, later, deps), processReferenceDigest(market, later, deps)]);
      assert.equal(sent.get("tax")!.length, 1);
      assert.deepEqual(sent.get("market")![0], sent.get("market")![1]);
      assert.equal((await readReferenceDigest(market, true)).config.topic, "capital_market");
      const tomorrow: string[] = [];
      await processReferenceDigest(tax, new Date("2035-01-03T02:01:00Z"), {
        references: getEditorialReferences, send: async (_d, text) => { tomorrow.push(text); return { status: "delivered", detail: null }; },
      });
      assert.match(tomorrow[0], /Cakupan: Standar akuntansi/);
      assert.ok(!tomorrow[0].includes("SPT Tahunan"));
      assert.equal((await readReferenceDigest(tax, true)).deliveries.length, 2);
      const empty = await org("topic_empty");
      await configureReferenceDigest(empty, "owner", { ...input, topic: "tax" }, resolve);
      let emptyPosts = 0;
      await processReferenceDigest(empty, now, {
        references: async () => original.filter(ref => ref.reportType !== "tax_return"),
        send: async () => { emptyPosts++; return { status: "delivered", detail: null }; },
      });
      assert.equal(emptyPosts, 0);
      assert.equal((await readReferenceDigest(empty, true)).deliveries[0].status, "empty");
    });
    await t.test("uncertain acknowledgement and interrupted claims are never replayed", async () => {
      const id = await prepare("uncertain");
      let count = 0;
      const uncertain = { references: getEditorialReferences, send: async (): Promise<SendOutcome> => {
        count++; return { status: "uncertain", detail: "Timeout" };
      } };
      await processReferenceDigest(id, now, uncertain);
      await processReferenceDigest(id, now, uncertain);
      assert.equal(count, 1);
      assert.equal((await readReferenceDigest(id, true)).config.enabled, false);
      const crashed = await prepare("crash");
      await assert.rejects(processReferenceDigest(crashed, now, { references: getEditorialReferences, send: async () => { throw new Error("Crash"); } }));
      assert.equal((await readReferenceDigest(crashed, true)).deliveries[0].status, "sending");
      const before = sends;
      await processReferenceDigest(crashed, now, delivered);
      assert.equal(sends, before);
      assert.equal((await readReferenceDigest(crashed, true)).deliveries[0].status, "uncertain");
      assert.equal((await readReferenceDigest(crashed, true)).config.enabled, false);
    });
    await t.test("unsubscribe cancels retries; revocation pauses; missed days do not replay", async () => {
      const id = await prepare("stop");
      await processReferenceDigest(id, now, { references: getEditorialReferences, send: async () => ({ status: "retry", detail: "Rate limited", retrySeconds: 60 }) });
      const response = await call(id, "owner", "DELETE");
      assert.equal(response.status, 200);
      const stopped = GetReferenceDigestResponse.parse(response.data);
      assert.equal(stopped.config.enabled, false);
      assert.equal(stopped.deliveries[0].status, "cancelled");
      const before = sends;
      await processReferenceDigest(id, new Date(now.getTime() + 60_000), delivered);
      assert.equal(sends, before);
      const revoked = await prepare("revoked");
      await db.delete(lktMemberships).where(eq(lktMemberships.organizationId, revoked));
      await processReferenceDigest(revoked, now, delivered);
      assert.equal((await readReferenceDigest(revoked, true)).config.enabled, false);
      assert.equal(sends, before);
      const missed = await prepare("missed");
      await processReferenceDigest(missed, new Date("2035-01-03T01:59:00Z"), delivered);
      assert.equal((await readReferenceDigest(missed, true)).deliveries.length, 0);
    });
    await t.test("stop cannot race a send, and empty digest does not post", async () => {
      const id = await prepare("race");
      let entered!: () => void, release!: () => void;
      const ready = new Promise<void>(r => { entered = r; });
      const gate = new Promise<void>(r => { release = r; });
      const job = processReferenceDigest(id, now, { references: getEditorialReferences, send: async () => {
        entered(); await gate; return { status: "delivered", detail: null };
      } });
      await ready;
      await assert.rejects(stopReferenceDigest(id, "owner"), (error: unknown) => error instanceof LktAccessError && error.status === 409);
      release();
      await job;
      await stopReferenceDigest(id, "owner");
      const empty = await prepare("empty");
      const before = sends;
      await processReferenceDigest(empty, now, { ...delivered, references: async () => [] });
      assert.equal(sends, before);
      assert.equal((await readReferenceDigest(empty, true)).deliveries[0].status, "empty");
    });
    await t.test("full-pool concurrency across distinct companies completes configuration, delivery, stop and later scheduler ticks", async () => {
      // Isolated schema only: exclude earlier fixture schedules from this tick.
      await db.update(lktReferenceDigests).set({ enabled: false });
      const size = pool.options.max;
      assert.equal(size, 10, "exercise the actual default pool limit");
      const ids = await Promise.all(Array.from({ length: size }, (_, index) => org(`capacity_${index}`)));
      const rendezvous = () => {
        let arrived = 0;
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        return async () => {
          if (++arrived === size) release();
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([gate, new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => reject(new Error("Full-pool barrier did not complete")), 5_000);
            })]);
          } finally { clearTimeout(timer); }
        };
      };
      const configureGate = rendezvous();
      // Every configuration owns its advisory-lock connection before release.
      await Promise.all(ids.map(id => configureReferenceDigest(id, "owner", input, async () => {
        await configureGate();
        return destination;
      })));
      const referenceGate = rendezvous();
      let posted = 0;
      await Promise.all(ids.map(id => processReferenceDigest(id, now, {
        references: async database => {
          await referenceGate();
          // Projection must use the locked connection too, not the shared pool.
          return getEditorialReferences(database);
        },
        send: async () => { posted++; return { status: "delivered", detail: null }; },
      })));
      assert.equal(posted, size);
      await Promise.all(ids.map(id => stopReferenceDigest(id, "owner")));
      const stopped = await Promise.all(ids.map(id => readReferenceDigest(id, true)));
      assert.equal(stopped.every(state => !state.config.enabled), true);
      await Promise.all(ids.map(id => configureReferenceDigest(id, "owner", { ...input, expectedRevision: 2 }, resolve)));
      const deps = { references: getEditorialReferences, send: async (): Promise<SendOutcome> => {
        posted++; return { status: "delivered", detail: null };
      } };
      // Subsequent scheduler instances still progress and deduplicate each other.
      const tomorrow = new Date("2035-01-03T02:01:00Z");
      await Promise.all([runReferenceDigestTick(tomorrow, deps), runReferenceDigestTick(tomorrow, deps)]);
      assert.equal(posted, size * 2);
      await runReferenceDigestTick(tomorrow, deps);
      assert.equal(posted, size * 2);
      assert.equal(pool.waitingCount, 0);
    });
    assert.deepEqual(await getEditorialReferences(), original, "delivery never changes findings, dates, schedule, or journal");
    await db.delete(lktOrganizations).where(eq(lktOrganizations.id, "fixture_dedupe"));
    assert.equal((await db.select().from(lktDigestDeliveries).where(eq(lktDigestDeliveries.organizationId, "fixture_dedupe"))).length, 0);
    assert.equal((await db.select().from(lktReferenceDigests).where(eq(lktReferenceDigests.organizationId, "fixture_dedupe"))).length, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await pool.end();
  }
});
