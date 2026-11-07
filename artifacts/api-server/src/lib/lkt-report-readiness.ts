import type { ChecklistItem, ReadinessFinding, Reference, ReportCycleDetail } from "@workspace/api-zod";
import type { LktReportCycle, LktWorkspace } from "@workspace/db";
import { checklist } from "./lkt-content";

export const readinessDisclaimer = "Diagnosis berasal dari profil dan status checklist yang diisi tim, bukan pemeriksaan dokumen atau angka. Persentase menunjukkan penyelesaian langkah, bukan tingkat kepatuhan. Ini bukan opini audit, penetapan standar yang berlaku, perhitungan pajak, atau bukti penyampaian resmi. Konfirmasikan ketentuan sesuai bentuk badan, sektor, dan periode dengan profesional.";

export function cycleTasks(cycle: LktReportCycle, workspace: LktWorkspace): ChecklistItem[] {
  return checklist.filter(t => t.scope === "umum" || t.scope === cycle.kind).map(t => ({
    ...t,
    status: (workspace.tasks[`${cycle.year}:${t.id}`]?.status ?? "belum") as ChecklistItem["status"],
    notes: workspace.tasks[`${cycle.year}:${t.id}`]?.notes ?? "",
  }));
}

export function cycleSummary(cycle: LktReportCycle, workspace: LktWorkspace) {
  const tasks = cycleTasks(cycle, workspace);
  const completed = tasks.filter(t => t.status === "selesai").length;
  return {
    id: cycle.id, year: cycle.year, kind: cycle.kind, standard: cycle.standard,
    legalForm: cycle.legalForm, coordinator: cycle.coordinator, notes: cycle.notes,
    revision: cycle.revision, updatedAt: cycle.updatedAt.toISOString(),
    completed, inProgress: tasks.filter(t => t.status === "proses").length,
    total: tasks.length, progress: tasks.length ? Math.round(completed / tasks.length * 100) : 0,
  };
}

export function diagnoseCycle(cycle: LktReportCycle, workspace: LktWorkspace, library: Reference[]): ReportCycleDetail {
  const tasks = cycleTasks(cycle, workspace);
  const findings: ReadinessFinding[] = [];
  const add = (id: string, severity: ReadinessFinding["severity"], title: string, detail: string,
    actionLabel: string, actionHref: string, referenceIds: string[] = []) =>
    findings.push({ id, severity, title, detail, actionLabel, actionHref, referenceIds });
  if (!workspace.profile.name.trim() || workspace.profile.name === "Perusahaan Anda") {
    add("company", "prioritas", "Identitas perusahaan belum dilengkapi",
      "Lengkapi nama perusahaan agar catatan kerja tidak tertukar. Tidak perlu memasukkan NPWP atau nomor rekening.",
      "Lengkapi profil", "/perusahaan");
  }
  if (cycle.legalForm === "belum_ditentukan") {
    add("legal-form", "prioritas", "Bentuk badan usaha perlu dikonfirmasi",
      "Kategori UMKM, publik, nonpublik, atau KJPP tidak menggantikan bentuk badan usaha. Jalur PT persekutuan modal berbeda dari PT perorangan.",
      "Tentukan bentuk badan", "#pengaturan", ["kemenkum-rupst"]);
  }
  if (cycle.kind === "publik" && ["pt_perorangan", "selain_pt"].includes(cycle.legalForm)) {
    add("profile-conflict", "prioritas", "Kombinasi profil perlu ditelaah",
      "Pilihan perusahaan publik dan bentuk badan ini perlu diklarifikasi. Diagnosis tidak menetapkan kewajiban hanya dari kategori profil.",
      "Periksa pengaturan", "#pengaturan", ["ojk", "ojk-annual"]);
  }
  if (cycle.standard === "Belum ditentukan") {
    add("standard", "prioritas", "Standar akuntansi belum ditentukan",
      "Minta akuntan mengonfirmasi kelayakan, akuntabilitas publik, dan standar untuk tahun buku ini. Label UMKM atau nonpublik saja tidak menentukan standar.",
      "Konfirmasi standar", "#pengaturan", ["iai-ep", "iai-emkm"]);
  } else {
    add("standard-scope", "informasi", "Pilihan standar masih perlu dasar penerapan",
      `${cycle.standard} adalah pilihan tim untuk tahun buku ${cycle.year}, bukan penetapan oleh aplikasi.${cycle.standard === "SAK Entitas Privat" && cycle.year < 2025 ? " Untuk periode sebelum 2025, konfirmasikan dasar penerapan dini dan ketentuan transisinya." : ""}`,
      "Baca batas referensi", "/referensi", ["iai-ep", "iai-emkm"]);
  }
  if (!cycle.coordinator.trim()) add("coordinator", "perhatian", "Penanggung jawab kerja belum dicatat",
    "Tentukan orang atau tim yang mengoordinasikan penyusunan dan tindak lanjut. Pencatatan ini tidak memberi izin akses baru.",
    "Isi penanggung jawab", "#pengaturan");

  const guidance: Record<string, [string, string[]]> = {
    Persiapan: ["Lengkapi profil, dasar standar, dan bukti transaksi sebelum menutup buku.", ["iai-ep", "iai-emkm", "kledo"]],
    Rekonsiliasi: ["Tuntaskan penelusuran kas/bank, piutang/utang, dan aset; jangan menutup selisih tanpa bukti.", ["kledo"]],
    Penyusunan: ["Tinjau jurnal penyesuaian dan komponen laporan sesuai standar yang telah dikonfirmasi.", ["zahir", "iai-ep", "iai-emkm"]],
    Perpajakan: ["Pisahkan rekonsiliasi fiskal dan SPT Tahunan dari laporan keuangan serta annual report. Prosedur dan tahun pajak perlu dikonfirmasi.", ["djp-spt"]],
    Finalisasi: ["Konfirmasikan kebutuhan penelaahan/audit, persetujuan, penerima, serta bukti penyampaian. Menandai selesai bukan bukti audit atau pelaporan resmi.", cycle.legalForm === "pt_modal" ? ["kemenkum-rupst"] : []],
    "Regulasi khusus": ["Periksa ketentuan sektor dan periode sebelum menerapkan prosedur. Checklist bukan penetapan kewajiban individual.", cycle.kind === "publik" ? ["ojk", "ojk-annual"] : ["pppk"]],
  };
  const phases = [...new Set(tasks.map(t => t.category))].map(name => {
    const group = tasks.filter(t => t.category === name);
    const incomplete = group.filter(t => t.status !== "selesai");
    if (incomplete.length) {
      const [advice, ids] = guidance[name] ?? ["Tinjau langkah yang belum selesai.", []];
      add(`phase-${name}`, name === "Rekonsiliasi" ? "prioritas" : "perhatian",
        `${name}: ${incomplete.length} langkah belum selesai`, advice,
        "Kerjakan langkah", `#task-${incomplete[0].id}`, ids);
    }
    return { name, completed: group.length - incomplete.length, total: group.length };
  });
  if (tasks.every(t => t.status === "selesai")) add("complete", "informasi", "Semua langkah ditandai selesai oleh tim",
    "Periksa kembali dokumen pendukung, persetujuan, dan bukti penyampaian. Status ini tidak menyatakan laporan telah diaudit atau perusahaan telah patuh.",
    "Diskusikan penelaahan akhir", "/konsultasi");

  const relevantIds = new Set(["iai-ep", "iai-emkm", "djp-spt", "zahir", "kledo",
    ...(cycle.legalForm === "pt_modal" ? ["kemenkum-rupst"] : []),
    ...(cycle.kind === "publik" ? ["ojk", "ojk-annual"] : []),
    ...(cycle.kind === "kjpp" ? ["pppk"] : [])]);
  // Include references used by a finding, including clarification of unknown forms.
  findings.forEach(f => f.referenceIds.forEach(id => relevantIds.add(id)));
  const references = library.filter(r => relevantIds.has(r.id));
  const needReview = references.filter(r => r.reviewOverdue || ["needs_review", "outdated", "unavailable"].includes(r.verificationStatus));
  if (needReview.length) add("source-review", "perhatian", `${needReview.length} referensi memerlukan perhatian editorial`,
    "Baca tanggal, periode, dan batas temuan di pustaka. Kesesuaian catatan dengan versi terbaru aplikasi tidak menjamin aturan masih berlaku untuk perusahaan Anda.",
    "Periksa pustaka", "/referensi", needReview.map(r => r.id));
  return { report: cycleSummary(cycle, workspace), companyName: workspace.profile.name,
    checklist: tasks, phases, findings, references, disclaimer: readinessDisclaimer };
}
