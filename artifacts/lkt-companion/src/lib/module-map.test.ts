import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { WORK_MODULES, ROLE_PATHS, parseWorkRole, selectWorkModules, type WorkRole } from "./module-map";

test("map has six distinct work modules and navigation roles are not access roles", () => {
  assert.equal(WORK_MODULES.length, 6);
  assert.equal(new Set(WORK_MODULES.map(m => m.id)).size, 6);
  assert.deepEqual(Object.keys(ROLE_PATHS), ["penyusun", "penelaah", "pimpinan"]);
  for (const role of Object.keys(ROLE_PATHS) as WorkRole[]) {
    assert.deepEqual(parseWorkRole(role), { role, invalid: false });
    assert.equal(selectWorkModules("", "semua", role).length, 6, "perspectives never hide other work modules");
    for (const moduleId of ROLE_PATHS[role].modules) assert.ok(WORK_MODULES.some(m => m.id === moduleId));
  }
  assert.deepEqual(parseWorkRole(null), { role: "penyusun", invalid: false });
  for (const unknown of ["owner", "member", "__proto__", "", "administrator"]) {
    assert.deepEqual(parseWorkRole(unknown), { role: "penyusun", invalid: true });
  }
});

test("search and availability filters work without changing metadata", () => {
  const original = JSON.stringify(WORK_MODULES);
  assert.deepEqual(selectWorkModules("  SPT  ", "semua", "penyusun").map(m => m.id), ["perpajakan"]);
  assert.deepEqual(selectWorkModules("bukti privat", "semua", "penyusun").map(m => m.id), ["dokumen-bukti"]);
  assert.equal(selectWorkModules("tidak-ada-modul-seperti-ini", "semua", "pimpinan").length, 0);
  assert.equal(selectWorkModules("", "tersedia", "penyusun").length, 5);
  assert.deepEqual(selectWorkModules("", "sebagian", "penyusun").map(m => m.id), ["dokumen-bukti"]);
  assert.equal(selectWorkModules("", "semua", "penelaah")[0].id, "pengendalian");
  assert.equal(JSON.stringify(WORK_MODULES), original);
});

test("private documents have no fake action while regulatory evidence links to the real library", () => {
  const documents = WORK_MODULES.find(m => m.id === "dokumen-bukti")!;
  assert.equal(documents.availability, "sebagian");
  const unavailable = documents.capabilities.find(c => !c.available)!;
  assert.equal(unavailable.href, undefined);
  assert.equal(unavailable.action, undefined);
  assert.match(unavailable.detail, /Belum tersedia/);
  assert.equal(documents.capabilities.find(c => c.available)!.href, "/referensi");
});

test("every available action and role step resolves to an existing app route", async () => {
  const app = await readFile(new URL("../App.tsx", import.meta.url), "utf8");
  const paths = [...app.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]);
  const actions = WORK_MODULES.flatMap(m => m.capabilities);
  const links = [
    ...actions.filter(c => c.available).map(c => c.href!),
    ...Object.values(ROLE_PATHS).flatMap(p => p.steps.map(s => s.href)),
  ];
  for (const href of links) {
    assert.ok(href?.startsWith("/") && !href.startsWith("//"));
    const url = new URL(href, "https://lktara.invalid");
    assert.ok(paths.includes(url.pathname), `Existing route required: ${href}`);
    const focus = url.searchParams.get("fokus");
    if (focus) assert.ok(["akuntansi", "perpajakan", "tahunan_rups"].includes(focus));
  }
  for (const capability of actions) {
    if (capability.available) assert.ok(capability.href && capability.action);
    else assert.equal(capability.href, undefined);
  }
});
