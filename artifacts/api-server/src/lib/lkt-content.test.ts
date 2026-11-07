import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BookmarkReferenceResponse, GetReferencesResponse, GetProblemsResponse } from "@workspace/api-zod";
import { checklist, problems, references } from "./lkt-content";
import { additionalReferences, editorialDay, withEditorialReview, withReviewReminder } from "./lkt-reference-review";
import { consultationReferenceContext, createReferenceSnapshot } from "./lkt-consultation-snapshot";

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

test("known outdated material stays limited while the later primary tax review is bounded", () => {
  assert.equal(references.find(r => r.id === "siplaw")?.verificationStatus, "outdated");
  assert.equal(references.find(r => r.id === "kledo")?.verificationStatus, "outdated");
  const tax = references.find(r => r.id === "djp-spt");
  assert.ok(tax);
  assert.equal(tax.verificationStatus, "verified_primary");
  assert.equal(tax.verified, true);
  assert.match(tax.verificationNotes, /Terverifikasi terbatas/);
  assert.match(tax.verificationNotes, /PER-12\/PJ\/2026/);
  assert.match(references.find(r => r.id === "kemendag-pencabutan")!.effectivePeriod, /30 Juni 2025/);
});

test("DJP adds a complete snapshot without changing initial findings, evidence or bookmark identity", () => {
  const tax = references.find(r => r.id === "djp-spt")!;
  const baseline = withEditorialReview(additionalReferences.find(r => r.id === "djp-spt")!, []);
  assert.equal(tax.id, baseline.id);
  assert.equal(tax.url, baseline.url);
  assert.equal(tax.reviewHistory.length, 2);
  assert.deepEqual(tax.reviewHistory[0], baseline.reviewHistory[0]);
  assert.equal(tax.reviewHistory[0].verificationStatus, "needs_review");
  assert.match(tax.reviewHistory[0].verificationNotes, /bukan pengganti naskah hukum/);
  assert.match(tax.reviewHistory[0].effectivePeriod, /belum diverifikasi penuh/);
  assert.equal(tax.reviewHistory[0].primarySources.length, 1);
  assert.equal(tax.reviewedAt, "2026-11-07");
  assert.equal(tax.editorialOwner, "Redaksi perpajakan");
  assert.equal(tax.nextReviewAt, "2026-12-07");
  const latest = tax.reviewHistory[1];
  for (const field of ["verificationStatus", "verificationNotes", "applicability", "effectivePeriod",
    "standards", "primarySources", "editorialOwner", "nextReviewAt"] as const) {
    assert.deepEqual(tax[field], latest[field], field);
  }
  assert.match(latest.changeSummary, /Riwayat awal tetap dipertahankan/);
  assert.deepEqual(GetReferencesResponse.parse([tax]), [tax]);
  assert.deepEqual(BookmarkReferenceResponse.parse({ ...tax, bookmarked: true }), { ...tax, bookmarked: true });
});

test("DJP findings cite the actual primary clauses and separate enactment, effect and transition", () => {
  const tax = references.find(r => r.id === "djp-spt")!;
  const base = tax.primarySources.find(p => p.url === tax.url)!;
  const change = tax.primarySources.find(p => p.title.includes("naskah PER-12"))!;
  const annex = tax.primarySources.find(p => p.url.endsWith("/Lampiran_PER12PJ2026.pdf"))!;
  assert.ok(base && change && annex);
  assert.match(base.locator, /80–85.*138–140.*143.*147/);
  assert.match(base.finding, /22 Mei 2025/);
  assert.match(base.finding, /Tahun Pajak sampai 2024.*berakhir sampai Desember 2024/);
  assert.match(base.finding, /PER-02\/PJ\/2019/);
  assert.match(change.url, /^https:\/\/www.pajak.go.id\/index.php\/id\/peraturan\//);
  assert.match(change.locator, /Pasal I angka 1–15 dan Pasal II angka 1–2/);
  assert.match(change.finding, /Ditetapkan 28 September 2026.*berlaku 1 Oktober 2026/);
  assert.match(change.finding, /huruf a:.*sebelum berlaku.*belum diproses\/diselesaikan.*PER-11\/PJ\/2025/);
  assert.match(change.finding, /Huruf b:.*setelah berlaku.*telah disampaikan sebelum berlaku/);
  assert.match(change.finding, /Masa Pajak sejak Januari 2025.*Bagian Tahun Pajak yang berakhir sejak Januari 2025.*Tahun Pajak sejak 2025/);
  assert.match(change.finding, /80A.*belum ada pemeriksaan atau pemeriksaan bukti permulaan secara terbuka/);
  assert.match(change.finding, /seluruh pembayaran PPh Pasal 29.*SKPPKP.*sebelum pembetulan/);
  assert.match(change.finding, /129A.*dengan syaratnya/);
  assert.match(change.finding, /129B.*tidak berlaku sejak SPT Tahunan pembetulan disampaikan/);
  assert.match(tax.effectivePeriod, /bukan tanggal metadata JDIH/);
  assert.match(annex.locator, /G:.*12a–12b.*H:.*18a–18b/);
  assert.match(annex.finding, /Pembacaan lampiran terbatas/);
  assert.doesNotMatch(JSON.stringify(tax.primarySources), /Pelaporan%20SPT%20Dalam/);
});

test("SPT guidance distinguishes individual UMKM from companies without computing personal tax decisions", () => {
  const tax = references.find(r => r.id === "djp-spt")!;
  assert.match(tax.applicability, /orang pribadi \(Pasal 81–83, Lampiran G\)/);
  assert.match(tax.applicability, /badan \(Pasal 84–85, Lampiran H\)/);
  assert.match(tax.applicability, /UMKM orang pribadi tidak otomatis mengikuti formulir\/prosedur badan/);
  assert.match(tax.verificationNotes, /Tidak menetapkan tarif, tenggat individual otomatis/);
  assert.match(tax.verificationNotes, /Masa PPN.*tidak digeneralisasi ke SPT Tahunan/);
  const checklistTax = checklist.find(c => c.id === "pajak")!.description;
  const problemTax = problems.find(p => p.id === "laba-fiskal")!.steps.join(" ");
  for (const guidance of [checklistTax, problemTax]) {
    assert.match(guidance, /UMKM orang pribadi tidak otomatis/);
    assert.match(guidance, /PER-11\/PJ\/2025.*PER-12\/PJ\/2026/);
    assert.match(guidance, /80A.*129A–129B/);
    assert.doesNotMatch(guidance, /masih perlu.*(ditelaah|telaah).*penuh/);
    assert.doesNotMatch(guidance, /\d+\s*%|31 Maret|30 April|1 Oktober 2026/);
  }
});

test("new consultation context uses the reviewed DJP snapshot without relabeling old provenance", () => {
  const tax = references.find(r => r.id === "djp-spt")!;
  const baseline = withEditorialReview(additionalReferences.find(r => r.id === "djp-spt")!, []);
  const context = consultationReferenceContext([tax])[0];
  assert.equal(context.reviewedAt, "2026-11-07");
  assert.deepEqual(context.primarySources, tax.primarySources);
  assert.equal(context.verificationStatus, "verified_primary");
  const oldSnapshot = createReferenceSnapshot([baseline], new Date("2026-11-06T00:00:00Z"));
  const original = structuredClone(oldSnapshot);
  const newSnapshot = createReferenceSnapshot([tax], new Date("2026-11-07T00:00:00Z"));
  assert.notEqual(newSnapshot.knowledgeVersion, oldSnapshot.knowledgeVersion);
  assert.equal(oldSnapshot.references[0].verificationStatus, "needs_review");
  assert.deepEqual(oldSnapshot, original);
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
  const initial = withEditorialReview(additionalReferences.find(r => r.id === "djp-spt")!, []);
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
