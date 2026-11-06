import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BookmarkReferenceResponse, GetReferencesResponse, GetProblemsResponse } from "@workspace/api-zod";
import { checklist, problems, references } from "./lkt-content";

test("all eleven original IDs and URLs survive alongside primary additions", () => {
  const originalIds = ["ciputra", "ajaib", "wordsmith", "bca", "hukumonline", "pppk", "levner", "zahir", "ojk", "kledo", "siplaw"];
  assert.equal(new Set(references.map(r => r.id)).size, references.length);
  for (const id of originalIds) {
    const r = references.find(r => r.id === id);
    assert.ok(r, id);
    assert.equal(new URL(r.url).protocol, "https:");
    assert.ok(r.verificationNotes.length > 40);
    assert.equal(r.reviewedAt, "2026-11-06");
  }
  assert.ok(references.length > originalIds.length);
});

test("reference and bookmark responses preserve every verification field", () => {
  const parsed = GetReferencesResponse.parse(references);
  assert.deepEqual(parsed, references);
  for (const r of references) {
    assert.deepEqual(BookmarkReferenceResponse.parse({ ...r, bookmarked: true }), { ...r, bookmarked: true });
    assert.deepEqual(BookmarkReferenceResponse.parse({ ...r, bookmarked: false }), { ...r, bookmarked: false });
    assert.ok(r.applicability.trim());
    assert.ok(r.effectivePeriod.trim());
    assert.match(r.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("read articles never become verified legal primary sources", () => {
  for (const r of references) {
    assert.equal(r.verified, r.verificationStatus === "verified_primary", r.id);
    if (r.verified) {
      assert.equal(r.sourceType, "primary", r.id);
      assert.ok(r.primarySources.length > 0, r.id);
    }
    if (r.sourceType === "secondary") assert.equal(r.verified, false, r.id);
    for (const p of r.primarySources) {
      assert.equal(new URL(p.url).protocol, "https:");
      assert.ok(p.title && p.locator && p.finding);
    }
  }
});

test("known outdated material and incomplete tax changes remain explicitly limited", () => {
  assert.equal(references.find(r => r.id === "siplaw")?.verificationStatus, "outdated");
  assert.equal(references.find(r => r.id === "kledo")?.verificationStatus, "outdated");
  const tax = references.find(r => r.id === "djp-spt");
  assert.ok(tax);
  assert.equal(tax.verificationStatus, "needs_review");
  assert.equal(tax.verified, false);
  assert.match(tax.verificationNotes, /PER-12\/PJ\/2026/);
  assert.match(references.find(r => r.id === "kemendag-pencabutan")!.effectivePeriod, /30 Juni 2025/);
});

test("incoming academic PDF remains accessible without becoming legal evidence", () => {
  const pdf = references.find(r => r.id === "setyorini-2007");
  assert.ok(pdf);
  assert.equal(pdf.url, "/api/lkt/reference-documents/setyorini-2007.pdf");
  assert.equal(pdf.sourceType, "secondary");
  assert.equal(pdf.verified, false);
  assert.equal(pdf.verificationStatus, "needs_review");
  assert.equal(pdf.primarySources.length, 0);
  assert.match(pdf.effectivePeriod, /2007/);
});

test("LegalMP findings cite official law without treating marketing or rollout dates as verified law", () => {
  const commercial = references.find(r => r.id === "legalmp")!;
  const official = references.find(r => r.id === "kemenkum-rupst")!;
  assert.equal(commercial.sourceType, "secondary");
  assert.equal(commercial.verified, false);
  assert.equal(commercial.verificationStatus, "reviewed_secondary");
  assert.equal(commercial.primarySources[0].url, official.url);
  assert.match(commercial.applicability, /perseroan persekutuan modal/i);
  assert.match(commercial.applicability, /perorangan/);
  assert.match(commercial.verificationNotes, /belum berhasil diperoleh/);
  assert.match(commercial.effectivePeriod, /1 Juni 2026/);
  assert.equal(official.sourceType, "primary");
  assert.equal(official.verified, true);
  assert.match(official.verificationNotes, /Terverifikasi terbatas/);
  assert.match(official.primarySources[0].finding, /30 hari kalender/);
  assert.match(official.primarySources[0].finding, /sejak notifikasi teguran/);
});

test("report types and standard transition periods remain distinct", () => {
  assert.equal(references.find(r => r.id === "ojk")?.reportType, "financial_report");
  assert.equal(references.find(r => r.id === "ojk-annual")?.reportType, "annual_report");
  assert.equal(references.find(r => r.id === "djp-spt")?.reportType, "tax_return");
  assert.match(references.find(r => r.id === "iai-ep")!.effectivePeriod, /1 Januari 2025/);
  assert.match(references.find(r => r.id === "iai-emkm")!.effectivePeriod, /1 Januari 2018/);
  assert.match(references.find(r => r.id === "pppk")!.applicability, /KJPP/);
});

test("all guidance citations resolve and regulatory guidance includes primary evidence", () => {
  GetProblemsResponse.parse(problems);
  for (const problem of problems) {
    for (const id of problem.referenceIds) assert.ok(references.some(r => r.id === id), `${problem.id}: ${id}`);
  }
  for (const id of ["beda-laporan", "standar-akuntansi", "penerima"]) {
    const problem = problems.find(p => p.id === id)!;
    assert.ok(problem.referenceIds.some(ref => references.some(r => r.id === ref && r.verified)), id);
  }
  assert.match(checklist.find(c => c.id === "ojk")!.description, /Pasal 16/);
  assert.match(checklist.find(c => c.id === "kjpp")!.description, /Pasal 52/);
  assert.match(problems.find(p => p.id === "penerima")!.steps.join(" "), /Nonpublik|nonpublik/);
});
