import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, FolderKanban, Loader2, Plus, X } from "lucide-react";
import {
  getGetReportCyclesQueryKey, getGetReportCycleQueryKey, useCreateReportCycle, useGetCompany, useGetReportCycles,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { errorStatus } from "@/lib/org-context";
import { EmptyState, ErrorState, KIND_LABEL, PageHeader, Shimmer, errorMessage, fmtDate, useDocTitle } from "@/components/lkt/common";
import { Field, LEGAL_LABEL, ProgressBar, REPORT_QUERY, SettingsFields, settingsErrors, type SettingsForm } from "@/components/lkt/report-shared";

export default function RuangLaporanPage() {
  useDocTitle("Ruang laporan");
  const list = useGetReportCycles({ query: { ...REPORT_QUERY, queryKey: getGetReportCyclesQueryKey() } });
  const [open, setOpen] = useState(false);
  const cycles = [...(list.data ?? [])].sort((a, b) => b.year - a.year);

  return (
    <>
      <PageHeader eyebrow="Ruang laporan per tahun buku" title="Ruang laporan"
        actions={<button data-testid="button-open-create" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--ink))] px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"><Plus className="h-4 w-4" /> Ruang tahun baru</button>}>
        Satu ruang untuk setiap tahun buku. Lihat apa yang belum siap berdasarkan daftar persiapan yang diisi tim. Persentase menunjukkan kelengkapan daftar, bukan kepatuhan hukum atau hasil audit.
      </PageHeader>

      {open && <CreatePanel existingYears={cycles.map((c) => c.year)} onClose={() => setOpen(false)} />}

      {list.isError ? <ErrorState title="Ruang laporan belum bisa dimuat" error={list.error} onRetry={() => list.refetch()} />
        : list.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <Shimmer key={i} className="h-44" />)}</div>
        : !cycles.length ? (
          !open && <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="Belum ada ruang laporan"
            action={<button data-testid="button-empty-create" onClick={() => setOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Buat ruang tahun pertama</button>}>
            Buat ruang untuk tahun buku yang sedang disiapkan. Catatan daftar persiapan untuk tahun yang sama ikut terbawa; tahun lain tidak disalin.
          </EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {cycles.map((c, i) => (
              <Link key={c.id} href={`/ruang-laporan/${c.id}`} data-testid={`card-report-${c.id}`} style={{ animationDelay: `${i * 60}ms` }}
                className="rise group relative overflow-hidden rounded-2xl border border-card-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_14px_34px_-20px_hsl(var(--primary))]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-4xl font-semibold tracking-tight text-foreground">{c.year}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{KIND_LABEL[c.kind]} · {c.standard}</p>
                    <p className="text-xs text-muted-foreground">{LEGAL_LABEL[c.legalForm]}{c.coordinator && ` · ${c.coordinator}`}</p>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs font-semibold">
                    <span data-testid={`text-progress-${c.id}`}>{c.completed}/{c.total} langkah ditandai siap</span>
                    <span className="font-mono text-primary">{Math.round(c.progress)}% lengkap</span>
                  </div>
                  <ProgressBar completed={c.completed} inProgress={c.inProgress} total={c.total} />
                  <p className="mt-2 text-[11px] text-muted-foreground">Diperbarui {fmtDate(c.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
    </>
  );
}

function CreatePanel({ existingYears, onClose }: { existingYears: number[]; onClose: () => void }) {
  const company = useGetCompany();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const c = company.data;
  const [year, setYear] = useState<number>(c?.year ?? new Date().getFullYear());
  const [form, setForm] = useState<SettingsForm>({ kind: c?.kind ?? "nonpublik", standard: c?.standard ?? "Belum ditentukan", legalForm: "belum_ditentukan", coordinator: "", notes: "" });
  const [conflict, setConflict] = useState("");
  const create = useCreateReportCycle({
    mutation: {
      onSuccess: (d) => {
        qc.invalidateQueries({ queryKey: getGetReportCyclesQueryKey() });
        qc.setQueryData(getGetReportCycleQueryKey(d.report.id), d);
        toast({ title: `Ruang laporan ${d.report.year} dibuat`, description: "Profil perusahaan tidak berubah." });
        setLocation(`/ruang-laporan/${d.report.id}`);
      },
      onError: (e) => {
        if (errorStatus(e) === 409) setConflict(`Ruang laporan untuk tahun ${year} sudah ada. Setiap perusahaan hanya memiliki satu ruang per tahun buku; buka ruang yang ada dari daftar.`);
        else toast({ variant: "destructive", title: "Ruang gagal dibuat", description: errorMessage(e) });
      },
    },
  });
  const yearErr = !Number.isInteger(year) || year < 2020 || year > 2100 ? "Tahun antara 2020 dan 2100." : existingYears.includes(year) ? "Ruang untuk tahun ini sudah ada." : "";
  const errs = settingsErrors(form);
  const invalid = !!yearErr || !!errs.coordinator || !!errs.notes;

  return (
    <form data-testid="form-create-report" onSubmit={(e) => { e.preventDefault(); setConflict(""); if (!invalid) create.mutate({ data: { year, ...form, coordinator: form.coordinator.trim(), notes: form.notes } }); }}
      className="rise mb-8 grid gap-6 rounded-2xl border border-primary/40 bg-card p-6 shadow-[0_20px_50px_-30px_hsl(var(--primary))] lg:grid-cols-[220px_1fr]">
      <div>
        <div className="flex items-center justify-between lg:block">
          <p className="font-display text-xl font-bold">Ruang tahun baru</p>
          <button type="button" data-testid="button-close-create" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Nilai awal diambil dari profil perusahaan. Memilih tahun di sini tidak mengubah profil.</p>
        <div className="mt-5">
          <Field label="Tahun buku" err={yearErr} hint="Tahun tidak bisa diubah setelah dibuat.">
            <input data-testid="input-report-year" type="number" min={2020} max={2100} value={Number.isNaN(year) ? "" : year} onChange={(e) => setYear(Number(e.target.value))}
              className="h-14 w-full rounded-lg border border-input bg-background px-3 font-mono text-2xl outline-none focus:ring-2 focus:ring-ring" />
          </Field>
        </div>
      </div>
      <div>
        <SettingsFields form={form} set={(p) => setForm({ ...form, ...p })} idPrefix="create" />
        {conflict && <p data-testid="text-create-conflict" className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">{conflict}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">Batal</button>
          <button data-testid="button-create-report" type="submit" disabled={invalid || create.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Buat ruang laporan
          </button>
        </div>
      </div>
    </form>
  );
}
