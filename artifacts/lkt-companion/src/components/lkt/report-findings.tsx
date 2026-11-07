import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ChevronDown, ClipboardList, History, Loader2, Plus, Search, X } from "lucide-react";
import {
  getGetReportFindingHistoryQueryKey, getGetReportFindingsQueryKey,
  useCreateReportFinding, useGetReportFindingHistory, useGetReportFindings, useUpdateReportFinding,
  type ReportFinding, type ReportFindingInputPriority, type ReportFindingInputStatus,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorStatus } from "@/lib/org-context";
import { EmptyState, ErrorState, Shimmer, errorMessage, fmtDate } from "./common";
import { Field } from "./report-shared";

export type FindingSeed = { title: string; detail: string; sourceDiagnosisId: string; nonce: number };

type Form = {
  title: string; problem: string; cause: string; evidenceNeeded: string; actionPlan: string; actionResult: string;
  assignee: string; targetDate: string; priority: ReportFindingInputPriority; status: ReportFindingInputStatus; reviewNote: string;
};
const FIELDS: (keyof Form)[] = ["title", "problem", "cause", "evidenceNeeded", "actionPlan", "actionResult", "assignee", "targetDate", "priority", "status", "reviewNote"];
const EMPTY: Form = { title: "", problem: "", cause: "", evidenceNeeded: "", actionPlan: "", actionResult: "", assignee: "", targetDate: "", priority: "sedang", status: "terbuka", reviewNote: "" };

export const FSTATUS: Record<ReportFindingInputStatus, { label: string; cls: string }> = {
  terbuka: { label: "Terbuka", cls: "bg-[hsl(var(--ink))] text-white" },
  proses: { label: "Dalam proses", cls: "bg-[hsl(var(--signal))] text-[hsl(var(--ink))]" },
  menunggu_telaah: { label: "Menunggu telaah", cls: "bg-primary text-primary-foreground" },
  ditutup: { label: "Ditutup", cls: "bg-[hsl(var(--ok))] text-white" },
};
const PRIO: Record<ReportFindingInputPriority, string> = { rendah: "Rendah", sedang: "Sedang", tinggi: "Tinggi" };
const LABEL: Record<string, string> = {
  title: "Judul", problem: "Masalah", cause: "Penyebab", evidenceNeeded: "Bukti yang dibutuhkan", actionPlan: "Rencana tindakan",
  actionResult: "Hasil tindakan", assignee: "PIC", targetDate: "Target internal", priority: "Prioritas", status: "Status",
  reviewNote: "Catatan telaah internal", archived: "Diarsipkan",
};
const LIMIT: Partial<Record<keyof Form, number>> = { title: 200, problem: 5000, cause: 3000, evidenceNeeded: 3000, actionPlan: 3000, actionResult: 3000, reviewNote: 3000, assignee: 150 };
const QUERY = { staleTime: 15000, refetchInterval: 30000, refetchOnMount: "always" as const, refetchOnWindowFocus: true };
const inputCls = "w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring";

export function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function toForm(f: ReportFinding): Form {
  return { title: f.title, problem: f.problem, cause: f.cause, evidenceNeeded: f.evidenceNeeded, actionPlan: f.actionPlan, actionResult: f.actionResult,
    assignee: f.assignee, targetDate: f.targetDate ?? "", priority: f.priority, status: f.status, reviewNote: f.reviewNote };
}
function payload(f: Form) {
  return { ...f, title: f.title.trim(), problem: f.problem.trim(), assignee: f.assignee.trim(), targetDate: f.targetDate || null };
}
function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {};
  if (!f.title.trim()) e.title = "Judul wajib diisi.";
  if (!f.problem.trim()) e.problem = "Uraian masalah wajib diisi.";
  for (const [k, max] of Object.entries(LIMIT)) if ((f[k as keyof Form] as string).length > max!) e[k as keyof Form] = `Maksimal ${max} karakter.`;
  if (f.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(f.targetDate)) e.targetDate = "Format tanggal YYYY-MM-DD.";
  if (f.status === "ditutup") {
    if (!f.actionResult.trim()) e.actionResult = "Wajib diisi sebelum menutup temuan.";
    if (!f.reviewNote.trim()) e.reviewNote = "Wajib diisi sebelum menutup temuan.";
  }
  return e;
}
const same = (a: Form, b: Form) => FIELDS.every((k) => a[k] === b[k]);
const overdue = (f: { targetDate: string | null; status: string }) => !!f.targetDate && f.status !== "ditutup" && f.targetDate < jakartaToday();

function useRefresh(reportId: string) {
  const qc = useQueryClient();
  return (findingId?: string) => {
    qc.invalidateQueries({ queryKey: getGetReportFindingsQueryKey(reportId) });
    if (findingId) qc.invalidateQueries({ queryKey: getGetReportFindingHistoryQueryKey(reportId, findingId) });
  };
}

export function ReportFindingsRegister({ reportId, seed, diagnosisTitles }: { reportId: string; seed: FindingSeed | null; diagnosisTitles: Map<string, string> }) {
  const q = useGetReportFindings(reportId, { query: { ...QUERY, enabled: !!reportId, queryKey: getGetReportFindingsQueryKey(reportId) } });
  const [creating, setCreating] = useState<{ form: Form; source: string | null; key: number } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"semua" | ReportFindingInputStatus>("semua");
  const [view, setView] = useState<"aktif" | "arsip">("aktif");
  const [openId, setOpenId] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const lastNonce = useRef<number | null>(null);

  useEffect(() => {
    if (!seed || seed.nonce === lastNonce.current) return;
    lastNonce.current = seed.nonce;
    if (creating && !window.confirm("Ganti draf temuan yang sedang terbuka? Isian yang belum disimpan akan dibuang.")) return;
    setCreating({ form: { ...EMPTY, title: seed.title.slice(0, 200), problem: seed.detail.slice(0, 5000) }, source: seed.sourceDiagnosisId, key: seed.nonce });
    window.setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }, [seed]);

  const all = q.data ?? [];
  const counts = useMemo(() => {
    const c = { aktif: 0, arsip: 0, terlambat: 0, terbuka: 0 };
    all.forEach((f) => { if (f.archived) c.arsip++; else { c.aktif++; if (f.status !== "ditutup") c.terbuka++; if (overdue(f)) c.terlambat++; } });
    return c;
  }, [all]);
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((f) => (view === "arsip") === f.archived)
      .filter((f) => status === "semua" || f.status === status)
      .filter((f) => !s || [f.title, f.problem, f.assignee, f.actionPlan, f.cause].some((t) => t.toLowerCase().includes(s)));
  }, [all, search, status, view]);

  return (
    <div ref={top} className="scroll-mt-24 space-y-4" data-testid="section-finding-register">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-card-border bg-border">
        {[["Belum ditutup", counts.terbuka], ["Lewat target internal", counts.terlambat], ["Diarsipkan", counts.arsip]].map(([l, v]) => (
          <div key={l as string} className="bg-card px-4 py-3">
            <p className="font-mono text-2xl font-semibold" data-testid={`stat-${l}`}>{q.data ? v : "-"}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input data-testid="input-finding-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul, masalah, PIC..." className={cn(inputCls, "h-10 pl-9")} />
        </div>
        <select data-testid="select-finding-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={cn(inputCls, "h-10 md:w-48")}>
          <option value="semua">Semua status</option>
          {Object.entries(FSTATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex rounded-lg bg-muted p-1">
          {(["aktif", "arsip"] as const).map((v) => (
            <button key={v} data-testid={`button-view-${v}`} onClick={() => setView(v)} className={cn("rounded-md px-3 py-1 text-xs font-bold", view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
              {v === "aktif" ? `Aktif (${counts.aktif})` : `Arsip (${counts.arsip})`}
            </button>
          ))}
        </div>
        <button data-testid="button-new-finding" onClick={() => {
          if (creating && !window.confirm("Ganti draf temuan yang sedang terbuka? Isian yang belum disimpan akan dibuang.")) return;
          setCreating({ form: EMPTY, source: null, key: Date.now() });
        }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[hsl(var(--ink))] px-4 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
          <Plus className="h-4 w-4" /> Catat temuan
        </button>
      </div>

      {creating && (
        <CreateForm key={creating.key} reportId={reportId} initial={creating.form} source={creating.source}
          sourceTitle={creating.source ? diagnosisTitles.get(creating.source) : undefined}
          onDone={(f) => { setCreating(null); if (f) { setView("aktif"); setOpenId(f.id); } }} />
      )}

      {q.isError && !q.data ? <ErrorState title="Register temuan belum bisa dimuat" error={q.error} onRetry={() => q.refetch()} />
        : !q.data ? <div className="space-y-2"><Shimmer className="h-20" /><Shimmer className="h-20" /></div>
        : !list.length ? (
          <EmptyState icon={<ClipboardList className="h-5 w-5" />} title={all.length ? "Tidak ada temuan yang cocok" : "Register masih kosong"}>
            {all.length ? "Ubah kata kunci, filter status, atau tampilan aktif/arsip." : "Catat masalah internal yang ditemukan tim beserta rencana perbaikannya, atau salin dari Diagnosis di atas."}
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {list.map((f) => <FindingRow key={f.id} f={f} reportId={reportId} open={openId === f.id} onToggle={() => setOpenId(openId === f.id ? null : f.id)} sourceTitle={f.sourceDiagnosisId ? diagnosisTitles.get(f.sourceDiagnosisId) : undefined} />)}
          </div>
        )}
      {q.isError && q.data && <p className="text-xs text-destructive">Pembaruan terakhir gagal; data di atas mungkin belum terbaru.</p>}
    </div>
  );
}

function FormFields({ form, set, errs, idp }: { form: Form; set: (p: Partial<Form>) => void; errs: Partial<Record<keyof Form, string>>; idp: string }) {
  const ta = (k: keyof Form, label: string, hint?: string, rows = 3) => (
    <Field label={label} err={errs[k]} hint={hint}>
      <textarea data-testid={`${idp}-${k}`} value={form[k] as string} rows={rows} maxLength={LIMIT[k]} onChange={(e) => set({ [k]: e.target.value })} className={cn(inputCls, "py-2.5")} />
    </Field>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2"><Field label="Judul" err={errs.title}><input data-testid={`${idp}-title`} value={form.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} className={cn(inputCls, "h-10")} /></Field></div>
      <div className="md:col-span-2">{ta("problem", "Masalah", "Hindari NPWP, nomor rekening, atau identitas pajak/bank.")}</div>
      {ta("cause", "Penyebab")}
      {ta("evidenceNeeded", "Bukti yang dibutuhkan", "Sebutkan saja; unggahan dokumen belum tersedia di sini.")}
      {ta("actionPlan", "Rencana tindakan")}
      {ta("actionResult", "Hasil tindakan")}
      <Field label="PIC (opsional)" err={errs.assignee} hint="Teks bebas; tidak memberi akses aplikasi.">
        <input data-testid={`${idp}-assignee`} value={form.assignee} maxLength={150} onChange={(e) => set({ assignee: e.target.value })} className={cn(inputCls, "h-10")} />
      </Field>
      <Field label="Target internal (opsional)" err={errs.targetDate} hint="Target tim, bukan tenggat hukum.">
        <div className="flex gap-2">
          <input type="date" data-testid={`${idp}-targetDate`} value={form.targetDate} onChange={(e) => set({ targetDate: e.target.value })} className={cn(inputCls, "h-10")} />
          {form.targetDate && <button type="button" onClick={() => set({ targetDate: "" })} className="rounded-lg border border-input px-2 text-muted-foreground hover:text-foreground" aria-label="Kosongkan tanggal"><X className="h-4 w-4" /></button>}
        </div>
      </Field>
      <Field label="Prioritas">
        <div className="flex gap-1.5">
          {(Object.keys(PRIO) as ReportFindingInputPriority[]).map((p) => (
            <button type="button" key={p} data-testid={`${idp}-priority-${p}`} onClick={() => set({ priority: p })}
              className={cn("flex-1 rounded-lg border px-2 py-2 text-xs font-bold", form.priority === p ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white" : "border-input hover:border-primary")}>{PRIO[p]}</button>
          ))}
        </div>
      </Field>
      <Field label="Status">
        <select data-testid={`${idp}-status`} value={form.status} onChange={(e) => set({ status: e.target.value as ReportFindingInputStatus })} className={cn(inputCls, "h-10")}>
          {Object.entries(FSTATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </Field>
      <div className="md:col-span-2">{ta("reviewNote", "Catatan telaah internal", "Diisi anggota tim mana pun; bukan persetujuan independen atau audit.")}</div>
    </div>
  );
}

function CreateForm({ reportId, initial, source, sourceTitle, onDone }: { reportId: string; initial: Form; source: string | null; sourceTitle?: string; onDone: (f?: ReportFinding) => void }) {
  const [form, setForm] = useState(initial);
  const [tried, setTried] = useState(false);
  const { toast } = useToast();
  const refresh = useRefresh(reportId);
  const errs = validate(form);
  const ok = !Object.keys(errs).length;
  const create = useCreateReportFinding({ mutation: {
    onSuccess: (f) => { refresh(f.id); toast({ title: "Temuan tercatat" }); onDone(f); },
    onError: (e) => toast({ variant: "destructive", title: "Temuan gagal disimpan", description: errorMessage(e) }),
  } });
  return (
    <form data-testid="form-new-finding" onSubmit={(e) => { e.preventDefault(); setTried(true); if (ok) create.mutate({ id: reportId, data: { ...payload(form), sourceDiagnosisId: source } }); }}
      className="rise rounded-2xl border-2 border-[hsl(var(--ink))] bg-card p-5">
      <p className="font-display text-lg font-bold">Temuan baru</p>
      {source && (
        <p data-testid="text-copied-source" className="mb-3 mt-1 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          Disalin dari Diagnosis{sourceTitle ? `: ${sourceTitle}` : ""}. Salinan ini tidak tersinkron; mengubah atau menutupnya tidak mengubah Diagnosis maupun daftar persiapan.
        </p>
      )}
      <fieldset disabled={create.isPending} className="mt-3"><FormFields form={form} set={(p) => setForm({ ...form, ...p })} errs={tried ? errs : { ...(form.status === "ditutup" ? { actionResult: errs.actionResult, reviewNote: errs.reviewNote } : {}) }} idp="new-finding" /></fieldset>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" data-testid="button-cancel-new-finding" onClick={() => { if (same(form, initial) || window.confirm("Buang draf temuan ini?")) onDone(); }} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Batal</button>
        <button data-testid="button-save-new-finding" type="submit" disabled={create.isPending || (tried && !ok)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan temuan
        </button>
      </div>
    </form>
  );
}

function FindingRow({ f, reportId, open, onToggle, sourceTitle }: { f: ReportFinding; reportId: string; open: boolean; onToggle: () => void; sourceTitle?: string }) {
  const st = FSTATUS[f.status];
  const late = overdue(f);
  return (
    <article data-testid={`card-report-finding-${f.id}`} className={cn("rounded-xl border bg-card transition-colors", open ? "border-primary/60" : "border-card-border hover:border-input", f.archived && "opacity-80")}>
      <button onClick={onToggle} data-testid={`button-toggle-report-finding-${f.id}`} className="flex w-full items-start gap-3 p-4 text-left">
        <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-primary")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", st.cls)}>{st.label}</span>
            {f.priority === "tinggi" && <span className="rounded border border-destructive/50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">Prioritas tinggi</span>}
            {f.archived && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Arsip</span>}
            <p className="font-semibold" data-testid={`text-report-finding-title-${f.id}`}>{f.title}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-foreground/80">{f.problem}</p>
          <p className="mt-1.5 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
            <span>PIC {f.assignee || "-"}</span>
            <span className={cn(late && "font-bold text-destructive")}>Target {f.targetDate ?? "-"}{late ? " (lewat)" : ""}</span>
            <span>rev {f.revision}</span>
            {f.sourceDiagnosisId && <span>dari Diagnosis{sourceTitle ? "" : " (tidak lagi muncul)"}</span>}
          </p>
        </div>
      </button>
      {open && <FindingDetail f={f} reportId={reportId} />}
    </article>
  );
}

function FindingDetail({ f, reportId }: { f: ReportFinding; reportId: string }) {
  const { toast } = useToast();
  const refresh = useRefresh(reportId);
  const [base, setBase] = useState(f);
  const [form, setForm] = useState(() => toForm(f));
  const [conflict, setConflict] = useState(false);
  const [tried, setTried] = useState(false);
  const [showHist, setShowHist] = useState(false);
  const dirty = !same(form, toForm(base));
  const stale = f.revision !== base.revision;

  useEffect(() => {
    if (f.revision !== base.revision && !dirty) { setBase(f); setForm(toForm(f)); setConflict(false); }
  }, [f, base.revision, dirty]);

  const upd = useUpdateReportFinding({ mutation: {
    onSuccess: (n) => { setBase(n); setForm(toForm(n)); setConflict(false); setTried(false); refresh(n.id); toast({ title: n.archived !== base.archived ? (n.archived ? "Temuan diarsipkan" : "Temuan dipulihkan") : "Temuan tersimpan" }); },
    onError: (e) => {
      if (errorStatus(e) === 409) { setConflict(true); refresh(f.id); }
      else toast({ variant: "destructive", title: "Temuan gagal disimpan", description: errorMessage(e) });
    },
  } });
  const errs = validate(form);
  const ok = !Object.keys(errs).length;
  const save = () => { setTried(true); if (ok) upd.mutate({ id: reportId, findingId: f.id, data: { ...payload(form), expectedRevision: base.revision, archived: base.archived } }); };
  const toggleArchive = () => {
    if (dirty) { toast({ variant: "destructive", title: "Simpan atau batalkan perubahan dulu" }); return; }
    if (!base.archived && !window.confirm("Arsipkan temuan ini? Temuan tidak dihapus dan bisa dipulihkan dari tampilan Arsip.")) return;
    upd.mutate({ id: reportId, findingId: f.id, data: { ...payload(toForm(base)), expectedRevision: base.revision, archived: !base.archived } });
  };
  const shownErrs = tried ? errs : form.status === "ditutup" ? { actionResult: errs.actionResult, reviewNote: errs.reviewNote } : {};

  return (
    <div className="rise border-t border-border px-4 pb-4 pt-4 md:pl-11">
      {base.closedAt && <p data-testid={`text-closed-${f.id}`} className="mb-3 text-xs text-muted-foreground">Ditutup {fmtDate(base.closedAt)} oleh {base.closedByUserId ?? "-"} (telaah internal, bukan audit).</p>}
      <fieldset disabled={upd.isPending}><FormFields form={form} set={(p) => setForm({ ...form, ...p })} errs={shownErrs} idp={`finding-${f.id}`} /></fieldset>
      {(conflict || (stale && dirty)) && (
        <div data-testid={`text-finding-conflict-${f.id}`} className="mt-4 rounded-lg border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/10 p-3 text-xs font-medium">
          {conflict ? "Temuan ini diubah anggota tim lain. Isian Anda belum disimpan dan tetap ada di formulir." : "Ada versi lebih baru dari anggota tim lain. Isian Anda dipertahankan; menyimpan akan ditolak sampai Anda memuat versi terbaru."}
          <button type="button" data-testid={`button-load-latest-finding-${f.id}`} onClick={() => { setBase(f); setForm(toForm(f)); setConflict(false); }} className="mt-2 block font-semibold text-primary hover:underline">
            Muat versi terbaru (rev {f.revision}) dan buang isian saya
          </button>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" data-testid={`button-archive-finding-${f.id}`} disabled={upd.isPending} onClick={toggleArchive}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-semibold hover:border-primary disabled:opacity-40">
          {base.archived ? <><ArchiveRestore className="h-4 w-4" /> Pulihkan</> : <><Archive className="h-4 w-4" /> Arsipkan</>}
        </button>
        <button type="button" data-testid={`button-history-finding-${f.id}`} onClick={() => setShowHist(!showHist)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm font-semibold hover:border-primary">
          <History className="h-4 w-4" /> {showHist ? "Tutup riwayat" : "Riwayat"}
        </button>
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">rev {base.revision} · {fmtDate(base.updatedAt)}</span>
        {dirty && <button type="button" onClick={() => { setForm(toForm(base)); setTried(false); }} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Batal</button>}
        <button type="button" data-testid={`button-save-finding-${f.id}`} disabled={!dirty || upd.isPending || conflict || stale || (tried && !ok)} onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{dirty ? "Simpan perubahan" : "Tersimpan"}
        </button>
      </div>
      {showHist && <FindingHistory reportId={reportId} findingId={f.id} />}
    </div>
  );
}

function fmtVal(k: string, v: unknown) {
  if (k === "status") return FSTATUS[v as ReportFindingInputStatus]?.label ?? String(v);
  if (k === "priority") return PRIO[v as ReportFindingInputPriority] ?? String(v);
  if (k === "archived") return v ? "Ya" : "Tidak";
  return v === null || v === "" ? "(kosong)" : String(v);
}

function FindingHistory({ reportId, findingId }: { reportId: string; findingId: string }) {
  const h = useGetReportFindingHistory(reportId, findingId, { query: { ...QUERY, enabled: !!findingId, queryKey: getGetReportFindingHistoryQueryKey(reportId, findingId) } });
  if (h.isError) return <div className="mt-4"><ErrorState title="Riwayat belum bisa dimuat" error={h.error} onRetry={() => h.refetch()} /></div>;
  if (!h.data) return <div className="mt-4 space-y-2"><Shimmer className="h-12" /><Shimmer className="h-12" /></div>;
  if (!h.data.length) return <p className="mt-4 text-xs text-muted-foreground">Belum ada riwayat.</p>;
  const keys = [...FIELDS, "archived"] as const;
  return (
    <ol data-testid={`list-history-${findingId}`} className="mt-4 space-y-3 border-l-2 border-border pl-4">
      {h.data.map((ev, i) => {
        const prev = h.data[i + 1]?.snapshot;
        const s = ev.snapshot as unknown as Record<string, unknown>;
        const p = prev as unknown as Record<string, unknown> | undefined;
        const changed = p ? keys.filter((k) => (s[k] ?? null) !== (p[k] ?? null)) : [];
        return (
          <li key={ev.id} data-testid={`history-event-${ev.id}`} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
            <p className="font-mono text-[11px] text-muted-foreground">rev {ev.revision} · {fmtDate(ev.createdAt)} · {ev.actorUserId}</p>
            {!p ? <p className="text-xs">Dicatat: <b>{ev.snapshot.title}</b> ({fmtVal("status", ev.snapshot.status)}, prioritas {fmtVal("priority", ev.snapshot.priority)})</p>
              : !changed.length ? <p className="text-xs text-muted-foreground">Disimpan tanpa perubahan isi.</p>
              : <ul className="mt-1 space-y-1">{changed.map((k) => (
                  <li key={k} className="text-xs"><span className="font-semibold">{LABEL[k]}:</span>{" "}
                    <span className="text-muted-foreground line-through decoration-destructive/60">{fmtVal(k, p[k]).slice(0, 300)}</span>{" "}
                    <span className="text-foreground">{fmtVal(k, s[k]).slice(0, 300)}</span></li>
                ))}</ul>}
            <details className="mt-2 rounded-lg border border-border bg-background p-2 text-xs">
              <summary className="cursor-pointer font-semibold text-primary">Lihat catatan lengkap versi ini</summary>
              <dl className="mt-2 space-y-2">
                {keys.map(k => <div key={k} className="min-w-0">
                  <dt className="font-semibold">{LABEL[k]}</dt>
                  <dd className="whitespace-pre-wrap break-words text-muted-foreground">{fmtVal(k, s[k])}</dd>
                </div>)}
              </dl>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
