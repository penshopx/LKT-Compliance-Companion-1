import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookMarked, ChevronDown, ClipboardPlus, Download, ExternalLink, Loader2, MessagesSquare, ShieldAlert } from "lucide-react";
import {
  getGetActivityQueryKey, getGetChecklistQueryKey, getGetDashboardQueryKey, getGetReportCycleQueryKey, getGetReportCyclesQueryKey,
  useGetReportCycle, useUpdateReportCycle, useUpdateReportCycleTask,
  type ChecklistItem, type ChecklistUpdateStatus, type ReportCycle, type ReportCycleDetail,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorStatus } from "@/lib/org-context";
import { ErrorState, KIND_LABEL, STATUS_LABEL, Shimmer, VerificationBadge, errorMessage, fmtDate, useDocTitle } from "@/components/lkt/common";
import { ReportFindingsRegister, type FindingSeed } from "@/components/lkt/report-findings";
import { LEGAL_LABEL, ProgressBar, REPORT_QUERY, SEVERITY, SettingsFields, buildDiagnosisText, downloadText, settingsErrors, type SettingsForm } from "@/components/lkt/report-shared";

const STATUSES: ChecklistUpdateStatus[] = ["belum", "proses", "selesai"];

function toForm(r: ReportCycle): SettingsForm {
  return { kind: r.kind, standard: r.standard, legalForm: r.legalForm, coordinator: r.coordinator, notes: r.notes };
}

export default function RuangLaporanDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <ReportCycleContent key={id} id={id} />;
}

// A draft belongs to its report year; never reuse component state for another ID.
function ReportCycleContent({ id }: { id: string }) {
  const q = useGetReportCycle(id, { query: { ...REPORT_QUERY, enabled: !!id, queryKey: getGetReportCycleQueryKey(id) } });
  const [focus, setFocus] = useState<string | null>(null);
  const [seed, setSeed] = useState<FindingSeed | null>(null);
  useDocTitle(q.data ? `Ruang laporan ${q.data.report.year}` : "Ruang laporan");

  const go = (href: string) => {
    const raw = href.slice(1);
    const el = document.getElementById(raw) ?? document.getElementById(`task-${raw}`);
    if (!el) return;
    setFocus(el.id);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setFocus((f) => (f === el.id ? null : f)), 2600);
  };

  if (q.isError) {
    const nf = errorStatus(q.error) === 404;
    return <><BackLink /><ErrorState title={nf ? "Ruang laporan tidak ditemukan di perusahaan ini" : "Ruang laporan belum bisa dimuat"} error={q.error} onRetry={nf ? undefined : () => q.refetch()} /></>;
  }
  if (!q.data) return <><BackLink /><div className="space-y-3"><Shimmer className="h-40" /><Shimmer className="h-24" /><Shimmer className="h-64" /></div></>;
  const d = q.data;
  const r = d.report;

  return (
    <>
      <BackLink />
      <Hero d={d} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-10">
          <Findings d={d} onAnchor={go} onFollowUp={(f) => setSeed({ title: f.title, detail: f.detail, sourceDiagnosisId: f.id, nonce: Date.now() })} />
          <section>
            <SectionTitle n="02" title="Temuan dan tindak lanjut" sub="Register internal tim. Terpisah dari Diagnosis otomatis; menutup temuan tidak mengubah daftar persiapan." />
            <ReportFindingsRegister reportId={id} seed={seed} diagnosisTitles={new Map(d.findings.map((f) => [f.id, f.title]))} />
          </section>
          <section>
            <SectionTitle n="03" title="Daftar persiapan tahun ini" sub={`Status dan catatan berlaku khusus untuk tahun ${r.year}.`} />
            <Tasks d={d} id={id} focus={focus} />
          </section>
        </div>
        <aside className="space-y-6">
          <Settings report={r} id={id} focused={focus === "pengaturan"} />
          <References d={d} />
          <div className="grid gap-2">
            <Link href="/konsultasi" data-testid="link-konsultasi" className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3.5 text-sm font-semibold transition-all hover:border-primary hover:text-primary"><MessagesSquare className="h-4 w-4" /> Tanyakan di Konsultasi AI <ArrowRight className="ml-auto h-4 w-4" /></Link>
            <Link href="/referensi" data-testid="link-referensi" className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-3.5 text-sm font-semibold transition-all hover:border-primary hover:text-primary"><BookMarked className="h-4 w-4" /> Semua referensi <ArrowRight className="ml-auto h-4 w-4" /></Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function BackLink() {
  return <Link href="/ruang-laporan" data-testid="link-back" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="h-4 w-4" /> Semua ruang laporan</Link>;
}

function SectionTitle({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{n}<span className="h-px flex-1 bg-border" /></p>
      <h2 className="font-display mt-2 text-2xl font-bold">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Hero({ d }: { d: ReportCycleDetail }) {
  const r = d.report;
  return (
    <section className="rise ink-grid relative overflow-hidden rounded-2xl bg-[hsl(var(--ink))] p-6 text-white md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--sidebar-primary))]">Ruang laporan · {d.companyName}</p>
          <p data-testid="text-report-year" className="mt-2 font-mono text-6xl font-semibold leading-none md:text-7xl">{r.year}</p>
          <p className="mt-3 text-sm text-sky-100/90">{KIND_LABEL[r.kind]} · {r.standard} · {LEGAL_LABEL[r.legalForm]}</p>
          {r.coordinator && <p className="text-sm text-sky-100/90">Koordinator: <span className="font-semibold text-white">{r.coordinator}</span></p>}
        </div>
        <div className="w-full md:w-72">
          <p className="font-mono text-4xl font-semibold text-[hsl(var(--sidebar-primary))]">{Math.round(r.progress)}%<span className="ml-2 text-sm font-medium text-sky-100/80">kelengkapan daftar</span></p>
          <div className="mt-3"><ProgressBar dark completed={r.completed} inProgress={r.inProgress} total={r.total} /></div>
          <p className="mt-2 text-xs text-sky-100/85">{r.completed} siap · {r.inProgress} dikerjakan · {r.total - r.completed - r.inProgress} belum mulai</p>
          <button data-testid="button-export-diagnosis" onClick={() => downloadText(`diagnosis-lktara-${r.year}.txt`, buildDiagnosisText(d))}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--sidebar-primary))] py-2 text-sm font-semibold text-[hsl(var(--ink))] transition-transform hover:-translate-y-0.5">
            <Download className="h-4 w-4" /> Unduh diagnosis (.txt)
          </button>
        </div>
      </div>
      {d.phases.length > 0 && (
        <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {d.phases.map((p) => (
            <div key={p.name} data-testid={`phase-${p.name}`}>
              <div className="flex justify-between text-xs"><span className="font-semibold text-white">{p.name}</span><span className="font-mono text-sky-100/85">{p.completed}/{p.total}</span></div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-[hsl(var(--ok))] transition-all duration-700" style={{ width: `${p.total ? (p.completed / p.total) * 100 : 0}%` }} /></div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 flex items-start gap-2 rounded-lg border border-white/15 bg-white/5 p-3 text-xs leading-relaxed text-sky-50">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--signal))]" />
        <span>{d.disclaimer} Diagnosis dihitung dari status yang diisi tim sendiri, bukan dari analisis dokumen. Semua langkah siap tidak berarti laporan telah diaudit atau patuh secara hukum.</span>
      </p>
    </section>
  );
}

function Findings({ d, onAnchor, onFollowUp }: { d: ReportCycleDetail; onAnchor: (h: string) => void; onFollowUp: (f: ReportCycleDetail["findings"][number]) => void }) {
  const refs = new Map(d.references.map((r) => [r.id, r]));
  return (
    <section>
      <SectionTitle n="01" title="Diagnosis" sub="Dihitung otomatis dari daftar persiapan tahun ini. Tim tidak mengedit bagian ini." />
      {!d.findings.length ? (
        <p data-testid="state-no-findings" className="rounded-xl border border-dashed border-input bg-card/60 p-5 text-sm text-muted-foreground">Tidak ada temuan dari daftar persiapan. Tetap konfirmasi dengan akuntan atau penasihat Anda sebelum laporan diserahkan.</p>
      ) : (
        <div className="space-y-2.5">
          {d.findings.map((f, i) => {
            const s = SEVERITY[f.severity] ?? SEVERITY.informasi;
            const cls = "inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all hover:gap-2.5";
            return (
              <article key={f.id} data-testid={`finding-${f.id}`} style={{ animationDelay: `${i * 50}ms` }} className="rise relative overflow-hidden rounded-xl border border-card-border bg-card p-4 pl-5">
                <span className={cn("absolute inset-y-0 left-0 w-1", s.bar)} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", s.cls)}>{s.label}</span>
                  <p className="font-semibold">{f.title}</p>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{f.detail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {f.actionHref.startsWith("#")
                    ? <button data-testid={`button-finding-action-${f.id}`} onClick={() => onAnchor(f.actionHref)} className={cls}>{f.actionLabel} <ArrowRight className="h-3.5 w-3.5" /></button>
                    : f.actionHref.startsWith("/")
                      ? <Link href={f.actionHref} data-testid={`link-finding-action-${f.id}`} className={cls}>{f.actionLabel} <ArrowRight className="h-3.5 w-3.5" /></Link>
                      : null}
                  <button data-testid={`button-follow-up-${f.id}`} onClick={() => onFollowUp(f)} className="inline-flex items-center gap-1.5 rounded-md border border-input px-2 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"><ClipboardPlus className="h-3.5 w-3.5" /> Catat tindak lanjut</button>
                  {f.referenceIds.map((rid) => refs.get(rid)).filter(Boolean).map((ref) => (
                    <a key={ref!.id} href={ref!.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline">{ref!.title}<ExternalLink className="h-3 w-3" /></a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Tasks({ d, id, focus }: { d: ReportCycleDetail; id: string; focus: string | null }) {
  const groups = new Map<string, ChecklistItem[]>();
  d.checklist.forEach((i) => groups.set(i.category, [...(groups.get(i.category) ?? []), i]));
  if (!d.checklist.length) return <p className="rounded-xl border border-dashed border-input p-5 text-sm text-muted-foreground">Tidak ada langkah untuk jenis perusahaan ini. Periksa pengaturan laporan.</p>;
  return (
    <div className="space-y-7">
      {[...groups.entries()].map(([cat, its]) => (
        <div key={cat}>
          <h3 className="mb-2 flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{cat}<span className="h-px flex-1 bg-border" />{its.filter((i) => i.status === "selesai").length}/{its.length}</h3>
          <div className="space-y-2">{its.map((i) => <TaskRow key={i.id} item={i} reportId={id} focused={focus === `task-${i.id}` || focus === i.id} />)}</div>
        </div>
      ))}
    </div>
  );
}

function useInvalidateAll(id: string) {
  const qc = useQueryClient();
  return (d: ReportCycleDetail) => {
    qc.setQueryData(getGetReportCycleQueryKey(id), d);
    qc.invalidateQueries({ queryKey: getGetReportCycleQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetReportCyclesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
  };
}

function TaskRow({ item, reportId, focused }: { item: ChecklistItem; reportId: string; focused: boolean }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes);
  const base = useRef(item.notes);
  const { toast } = useToast();
  const refresh = useInvalidateAll(reportId);

  // Follow server notes only when the local form is not dirty.
  useEffect(() => {
    if (item.notes === base.current) return;
    setNotes((cur) => (cur === base.current ? item.notes : cur));
    base.current = item.notes;
  }, [item.notes]);
  useEffect(() => { if (focused) setOpen(true); }, [focused]);

  const upd = useUpdateReportCycleTask({
    mutation: {
      onSuccess: (d, vars) => {
        base.current = vars.data.notes;
        setNotes((cur) => cur);
        refresh(d);
      },
      onError: (e) => toast({ variant: "destructive", title: "Gagal menyimpan langkah", description: errorMessage(e) }),
    },
  });
  const save = (status: ChecklistUpdateStatus, n: string) => upd.mutate({ id: reportId, taskId: item.id, data: { status, notes: n } });
  const dirty = notes !== item.notes;

  return (
    <div id={`task-${item.id}`} data-testid={`row-task-${item.id}`}
      className={cn("scroll-mt-24 rounded-xl border bg-card transition-all duration-500", focused ? "border-primary ring-4 ring-primary/25" : open ? "border-primary/60" : "border-card-border hover:border-input")}>
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <button onClick={() => setOpen(!open)} data-testid={`button-toggle-task-${item.id}`} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-primary")} />
          <div className="min-w-0">
            <p className={cn("font-semibold", item.status === "selesai" && "text-muted-foreground line-through decoration-[hsl(var(--ok))]")}>{item.title}</p>
            {!open && item.notes && <p className="truncate text-xs text-muted-foreground">Catatan: {item.notes}</p>}
            {dirty && !open && <p className="text-xs font-semibold text-[hsl(30_90%_32%)]">Catatan belum disimpan</p>}
          </div>
        </button>
        <div className="flex items-center gap-1 self-start rounded-lg bg-muted p-1 md:self-auto">
          {STATUSES.map((s) => (
            <button key={s} data-testid={`button-task-status-${s}-${item.id}`} disabled={upd.isPending} onClick={() => s !== item.status && save(s, item.notes)}
              className={cn("rounded-md px-2.5 py-1 text-[11px] font-bold transition-all", item.status === s
                ? s === "selesai" ? "bg-[hsl(var(--ok))] text-white" : s === "proses" ? "bg-[hsl(var(--signal))] text-[hsl(var(--ink))]" : "bg-[hsl(var(--ink))] text-white"
                : "text-muted-foreground hover:bg-card hover:text-foreground")}>{STATUS_LABEL[s]}</button>
          ))}
          {upd.isPending && <Loader2 className="mx-1 h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
      </div>
      {open && (
        <div className="rise border-t border-border px-4 pb-4 pt-3 md:pl-11">
          <p className="text-sm leading-relaxed text-foreground/85">{item.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">Cakupan: <span className="font-semibold text-foreground">{item.scope}</span></p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catatan kerja tahun ini</label>
          <textarea data-testid={`input-task-notes-${item.id}`} value={notes} maxLength={5000} rows={3} onChange={(e) => setNotes(e.target.value)}
            placeholder="Siapa memegang dokumen, apa yang masih ditunggu. Hindari angka keuangan sensitif."
            className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-2 flex items-center justify-end gap-2">
            {dirty && <button onClick={() => setNotes(item.notes)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Batal</button>}
            <button data-testid={`button-save-task-notes-${item.id}`} disabled={!dirty || upd.isPending} onClick={() => save(item.status, notes)}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
              {upd.isPending ? "Menyimpan..." : "Simpan catatan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Settings({ report, id, focused }: { report: ReportCycle; id: string; focused: boolean }) {
  const { toast } = useToast();
  const refresh = useInvalidateAll(id);
  const [base, setBase] = useState<ReportCycle>(report);
  const [form, setForm] = useState<SettingsForm>(() => toForm(report));
  const [conflict, setConflict] = useState("");
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(base));
  const stale = report.revision !== base.revision;

  useEffect(() => {
    if (report.revision !== base.revision && !dirty) { setBase(report); setForm(toForm(report)); }
  }, [report, base.revision, dirty]);

  const upd = useUpdateReportCycle({
    mutation: {
      onSuccess: (d) => { setBase(d.report); setForm(toForm(d.report)); setConflict(""); refresh(d); toast({ title: "Pengaturan laporan tersimpan" }); },
      onError: (e) => {
        if (errorStatus(e) === 409) setConflict("Pengaturan ini diubah anggota tim lain sejak Anda mulai mengedit. Perubahan Anda belum disimpan. Muat versi terbaru, lalu terapkan ulang perubahan Anda.");
        else toast({ variant: "destructive", title: "Pengaturan gagal disimpan", description: errorMessage(e) });
      },
    },
  });
  const errs = settingsErrors(form);

  return (
    <form id="pengaturan" data-testid="form-settings" onSubmit={(e) => { e.preventDefault(); if (!errs.coordinator && !errs.notes) upd.mutate({ id, data: { expectedRevision: base.revision, ...form, coordinator: form.coordinator.trim() } }); }}
      className={cn("scroll-mt-24 rounded-2xl border bg-card p-5 transition-all duration-500", focused ? "border-primary ring-4 ring-primary/25" : "border-card-border")}>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold">Pengaturan laporan</p>
        <span className="font-mono text-[11px] text-muted-foreground">rev {base.revision}</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">Tahun buku {report.year} tetap. Profil perusahaan tidak ikut berubah. Diperbarui {fmtDate(report.updatedAt)}.</p>
      <SettingsFields form={form} set={(p) => setForm({ ...form, ...p })} idPrefix="settings" />
      {(conflict || (stale && dirty)) && (
        <div data-testid="text-settings-conflict" className="mt-4 rounded-lg border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/10 p-3 text-xs font-medium text-foreground">
          {conflict || "Ada versi lebih baru dari anggota tim lain. Isian Anda dipertahankan; menyimpan akan ditolak sampai Anda memuat versi terbaru."}
          <button type="button" data-testid="button-load-latest" onClick={() => { setBase(report); setForm(toForm(report)); setConflict(""); }} className="mt-2 block font-semibold text-primary hover:underline">Muat versi terbaru (buang isian saya)</button>
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty && <button type="button" onClick={() => setForm(toForm(base))} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Batal</button>}
        <button data-testid="button-save-settings" type="submit" disabled={!dirty || !!errs.coordinator || !!errs.notes || upd.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--ink))] px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
          {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{dirty ? "Simpan pengaturan" : "Tersimpan"}
        </button>
      </div>
    </form>
  );
}

function References({ d }: { d: ReportCycleDetail }) {
  if (!d.references.length) return null;
  return (
    <section className="rounded-2xl border border-card-border bg-card p-5">
      <p className="font-display text-lg font-bold">Referensi terkait</p>
      <p className="mb-3 text-xs text-muted-foreground">Bacaan pendukung, bukan nasihat hukum. Periksa tanggal telaah.</p>
      <ul className="space-y-3">
        {d.references.map((r) => (
          <li key={r.id} data-testid={`ref-${r.id}`}>
            <a href={r.url} target="_blank" rel="noreferrer" className="group block">
              <p className="text-sm font-semibold leading-snug group-hover:text-primary">{r.title} <ExternalLink className="inline h-3 w-3" /></p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.publisher} · ditelaah {r.reviewedAt}</p>
            </a>
            <div className="mt-1"><VerificationBadge status={r.verificationStatus} /></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
