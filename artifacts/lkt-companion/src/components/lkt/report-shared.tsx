import type { ReactNode } from "react";
import type { ReportCycleDetail, ReportCycleInputKind, ReportCycleInputLegalForm, ReportCycleInputStandard } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL, STATUS_LABEL } from "./common";

export const REPORT_QUERY = { staleTime: 0, refetchInterval: 30000, refetchOnMount: "always" as const };

export const KINDS: ReportCycleInputKind[] = ["nonpublik", "umkm", "publik", "kjpp"];
export const STANDARDS: ReportCycleInputStandard[] = ["Belum ditentukan", "SAK EMKM", "SAK Entitas Privat", "SAK Indonesia"];
export const LEGAL_FORMS: ReportCycleInputLegalForm[] = ["belum_ditentukan", "pt_modal", "pt_perorangan", "selain_pt"];
export const LEGAL_LABEL: Record<string, string> = {
  belum_ditentukan: "Belum ditentukan",
  pt_modal: "PT persekutuan modal",
  pt_perorangan: "PT perorangan",
  selain_pt: "Selain PT (CV, firma, koperasi, dll.)",
};
export const SEVERITY: Record<string, { label: string; cls: string; bar: string }> = {
  prioritas: { label: "Prioritas", cls: "bg-destructive text-destructive-foreground", bar: "bg-destructive" },
  perhatian: { label: "Perhatian", cls: "bg-[hsl(var(--signal))] text-[hsl(var(--ink))]", bar: "bg-[hsl(var(--signal))]" },
  informasi: { label: "Informasi", cls: "bg-primary text-primary-foreground", bar: "bg-primary" },
};

export type SettingsForm = { kind: ReportCycleInputKind; standard: ReportCycleInputStandard; legalForm: ReportCycleInputLegalForm; coordinator: string; notes: string };

export function settingsErrors(f: SettingsForm) {
  return {
    coordinator: f.coordinator.length > 150 ? "Maksimal 150 karakter." : "",
    notes: f.notes.length > 5000 ? "Maksimal 5000 karakter." : "",
  };
}

export function Field({ label, err, hint, children }: { label: string; err?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
      {hint && !err && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {err && <p className="mt-1 text-xs font-medium text-destructive">{err}</p>}
    </div>
  );
}

const input = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

export function SettingsFields({ form, set, idPrefix }: { form: SettingsForm; set: (p: Partial<SettingsForm>) => void; idPrefix: string }) {
  const errs = settingsErrors(form);
  return (
    <div className="space-y-5">
      <Field label="Jenis perusahaan">
        <div className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((k) => (
            <button type="button" key={k} data-testid={`${idPrefix}-kind-${k}`} onClick={() => set({ kind: k })}
              className={cn("rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-all", form.kind === k ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white" : "border-input bg-background hover:border-primary")}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Standar akuntansi" hint="Belum yakin? Pilih Belum ditentukan dan diskusikan dengan akuntan Anda.">
        <div className="flex flex-wrap gap-2">
          {STANDARDS.map((s) => (
            <button type="button" key={s} data-testid={`${idPrefix}-standard-${s}`} onClick={() => set({ standard: s })}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors", form.standard === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:border-primary")}>{s}</button>
          ))}
        </div>
      </Field>
      <Field label="Bentuk badan usaha">
        <select data-testid={`${idPrefix}-legal`} value={form.legalForm} onChange={(e) => set({ legalForm: e.target.value as ReportCycleInputLegalForm })} className={cn(input, "h-11")}>
          {LEGAL_FORMS.map((l) => <option key={l} value={l}>{LEGAL_LABEL[l]}</option>)}
        </select>
      </Field>
      <Field label="Koordinator (opsional)" err={errs.coordinator} hint="Nama atau peran, misalnya Manajer Keuangan.">
        <input data-testid={`${idPrefix}-coordinator`} value={form.coordinator} maxLength={150} onChange={(e) => set({ coordinator: e.target.value })} className={cn(input, "h-11")} />
      </Field>
      <Field label="Catatan laporan (opsional)" err={errs.notes} hint="Jangan masukkan NPWP, nomor rekening, atau angka keuangan.">
        <textarea data-testid={`${idPrefix}-notes`} value={form.notes} maxLength={5000} rows={3} onChange={(e) => set({ notes: e.target.value })} className={cn(input, "py-2.5")} />
      </Field>
    </div>
  );
}

export function ProgressBar({ completed, inProgress, total, dark }: { completed: number; inProgress: number; total: number; dark?: boolean }) {
  const p = total ? (completed / total) * 100 : 0;
  const q = total ? (inProgress / total) * 100 : 0;
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-muted")}>
      <div className="h-full bg-[hsl(var(--ok))] transition-all duration-700" style={{ width: `${p}%` }} />
      <div className="h-full bg-[hsl(var(--signal))] transition-all duration-700" style={{ width: `${q}%` }} />
    </div>
  );
}

export function buildDiagnosisText(d: ReportCycleDetail) {
  const r = d.report;
  const lines = [
    `LKTara - Diagnosis persiapan laporan tahunan ${r.year}`,
    `Perusahaan: ${d.companyName}`,
    `Jenis: ${KIND_LABEL[r.kind]} | Standar: ${r.standard} | Bentuk: ${LEGAL_LABEL[r.legalForm]}`,
    `Koordinator: ${r.coordinator || "-"}`,
    `Diunduh: ${new Date().toISOString()} | Revisi ${r.revision}`,
    "",
    "PENTING: Dokumen ini adalah ringkasan swa-laporan dari daftar persiapan, bukan hasil audit, opini, atau sertifikasi kepatuhan hukum.",
    d.disclaimer,
    "",
    `Kelengkapan daftar: ${r.completed} dari ${r.total} langkah ditandai siap, ${r.inProgress} sedang dikerjakan.`,
    "",
    "FASE",
    ...d.phases.map((p) => `- ${p.name}: ${p.completed}/${p.total}`),
    "",
    "TEMUAN",
    ...(d.findings.length ? d.findings.map((f) => `- [${SEVERITY[f.severity]?.label ?? f.severity}] ${f.title}\n  ${f.detail}`) : ["- Tidak ada temuan dari daftar persiapan."]),
    "",
    "DAFTAR LANGKAH",
    ...d.checklist.map((c) => `- [${STATUS_LABEL[c.status]}] ${c.category} / ${c.title}${c.notes ? `\n  Catatan: ${c.notes}` : ""}`),
    "",
    "REFERENSI",
    ...d.references.map((x) => `- ${x.title} (${x.publisher}) ${x.url}`),
  ];
  return lines.join("\n");
}

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
