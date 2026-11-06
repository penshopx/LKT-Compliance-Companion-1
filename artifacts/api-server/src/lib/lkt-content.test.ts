import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BookmarkReferenceResponse, GetReferencesResponse, GetProblemsResponse } from "@workspace/api-zod";
import { checklist, problems, references } from "./lkt-content";
import { editorialDay, withEditorialReview, withReviewReminder } from "./lkt-reference-review";

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
  assert.match(commercial.verificationNotes, /sumber sekunder komersial/);
  assert.match(commercial.summary, /temuan terbaru dan bukti pengumuman asli AHU/);
  assert.doesNotMatch(commercial.summary, /masih perlu pengumuman/);
  assert.match(commercial.effectivePeriod, /1 Juni 2026/);
  assert.equal(official.sourceType, "primary");
  assert.equal(official.verified, true);
  assert.match(official.verificationNotes, /Terverifikasi terbatas/);
  assert.match(official.primarySources[0].finding, /30 hari kalender/);
  assert.match(official.primarySources[0].finding, /sejak notifikasi teguran/);
});

test("RUPST operational dates have original AHU evidence and a separate official promulgation date", () => {
  for (const id of ["legalmp", "kemenkum-rupst"]) {
    const reference = references.find(r => r.id === id)!;
    const metadata = reference.primarySources.find(p => p.url === "https://peraturan.bpk.go.id/Details/350901/permenkum-no-49-tahun-2025")!;
    assert.ok(metadata);
    assert.match(metadata.finding, /Ditetapkan 11 Desember 2025; diundangkan dan berlaku 17 Desember 2025/);
    assert.match(metadata.finding, /1076/);
    const launch = reference.primarySources.find(p => p.url === "https://www.instagram.com/p/DYzKsm7zVmm/")!;
    const sanctions = reference.primarySources.find(p => p.url === "https://www.instagram.com/p/De_cAWjk26F/")!;
    assert.ok(launch && sanctions);
    assert.match(launch.finding, /1 Juni 2026/);
    assert.match(launch.finding, /pengumuman operasional awal/);
    assert.match(sanctions.locator, /caption butir 1–5 dan poster carousel halaman 3–7/);
    assert.match(sanctions.finding, /1 November 2026/);
    assert.match(sanctions.finding, /30 hari sejak ditandatangani/);
    assert.match(sanctions.finding, /teguran tertulis 1–31 Desember 2026/);
    assert.match(sanctions.finding, /pemblokiran akses SABH mulai 2 Januari 2027/);
    assert.match(sanctions.finding, /periode 2025/);
    assert.match(reference.effectivePeriod, /nonelektronik paling lama 6 bulan/);
    assert.match(reference.verificationNotes, /31 Desember sebagai masa bebas teguran/);
    assert.match(reference.verificationNotes, /tetap sumber sekunder/);
    assert.match(reference.applicability, /perseroan persekutuan modal/);
    assert.match(reference.applicability, /perorangan tetap mengikuti Pasal 27–28/);
    assert.match(reference.verificationNotes, /Tidak menetapkan tenggat otomatis/);
    assert.match(sanctions.finding, /PT didirikan pada 2026 atau belum habis tahun buku 2026/);
    assert.equal(reference.reviewHistory.length, 2);
    assert.match(reference.reviewHistory[0].verificationNotes, /belum berhasil diperoleh/);
    assert.match(reference.reviewHistory[0].effectivePeriod, /belum.*dipastikan/);
    assert.notDeepEqual(reference.primarySources, reference.reviewHistory[0].primarySources);
    assert.equal(reference.reviewHistory[0].primarySources.length, 1);
  }
});

test("operational sanctions are reference findings, never profile-wide automatic deadlines", () => {
  const guidance = JSON.stringify({ checklist, problems });
  assert.doesNotMatch(guidance, /1 Juni 2026|1 November 2026|1–31 Desember 2026|2 Januari 2027/);
  const official = references.find(r => r.id === "kemenkum-rupst")!;
  assert.match(official.verificationNotes, /tahapan Pasal 17–20/);
  assert.match(official.effectivePeriod, /PNBP Rp0 sampai 31 Desember 2026 bukan tenggat bebas sanksi/);
  assert.equal(references.find(r => r.id === "legalmp")!.verified, false);
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

test("every reference has an accountable role, schedule and retained initial findings", () => {
  for (const reference of references) {
    assert.ok(reference.editorialOwner.trim(), reference.id);
    assert.match(reference.nextReviewAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(reference.nextReviewAt > reference.reviewedAt, reference.id);
    assert.ok(reference.reviewHistory.length > 0, reference.id);
    const first = reference.reviewHistory[0];
    assert.match(first.changeSummary, /bukan verifikasi ulang/);
    assert.equal(first.recordedAt, "2026-11-06");
    const latest = reference.reviewHistory.at(-1)!;
    assert.equal(reference.verificationNotes, latest.verificationNotes);
    assert.equal(reference.verificationStatus, latest.verificationStatus);
    assert.equal(reference.nextReviewAt, latest.nextReviewAt);
    assert.deepEqual(reference.primarySources, latest.primarySources);
  }
});

test("review reminders switch only after the scheduled day, using WIB even across UTC boundaries", () => {
  const reference = { ...references[0], nextReviewAt: "2026-12-06" };
  assert.equal(editorialDay(new Date("2026-12-06T17:00:00Z")), "2026-12-07");
  assert.equal(withReviewReminder(reference, new Date("2026-12-05T16:59:59Z")).reviewOverdue, false);
  assert.equal(withReviewReminder(reference, new Date("2026-12-05T17:00:00Z")).reviewOverdue, false);
  assert.equal(withReviewReminder(reference, new Date("2026-12-06T16:59:59Z")).reviewOverdue, false);
  assert.equal(withReviewReminder(reference, new Date("2026-12-06T17:00:00Z")).reviewOverdue, true);
});

test("overdue and bookmark responses never upgrade, downgrade or erase verification findings", () => {
  for (const reference of references) {
    const future = withReviewReminder(reference, new Date("2030-01-01T00:00:00Z"));
    assert.equal(future.reviewOverdue, true);
    assert.deepEqual(future, { ...reference, reviewOverdue: true });
    const bookmarked = BookmarkReferenceResponse.parse({ ...future, bookmarked: true });
    assert.deepEqual(bookmarked, { ...reference, reviewOverdue: true, bookmarked: true });
    assert.equal(bookmarked.reviewedAt, reference.reviewedAt);
  }
});

test("subsequent editorial snapshots retain earlier findings and evidence instead of replacing history", () => {
  const initial = references.find(r => r.id === "djp-spt")!;
  const before = structuredClone(initial);
  const event = {
    ...initial.reviewHistory[0],
    recordedAt: "2026-12-06",
    nextReviewAt: "2027-01-05",
    changeSummary: "Contoh uji: peninjauan berkala belum memperoleh naskah perubahan.",
    verificationNotes: "Contoh uji: temuan diperbarui secara editorial, belum terverifikasi penuh.",
  };
  const result = withEditorialReview(initial, [event]);
  assert.equal(result.reviewHistory.length, 2);
  assert.deepEqual(result.reviewHistory[0], before.reviewHistory[0]);
  assert.deepEqual(result.reviewHistory[1], event);
  assert.equal(result.verificationNotes, event.verificationNotes);
  assert.equal(result.reviewedAt, event.recordedAt);
  assert.equal(result.nextReviewAt, event.nextReviewAt);
  assert.equal(result.verified, false);
  assert.deepEqual(initial, before);
  assert.deepEqual(GetReferencesResponse.parse([result]), [result]);
});
