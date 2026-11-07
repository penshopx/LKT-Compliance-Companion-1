import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, FilePenLine, Lock, Plus, RefreshCw, Trash2, X } from "lucide-react";
import {
  getGetEditorialWorkspaceQueryKey, getGetReferencesQueryKey, useAppendEditorialEvent, useGetEditorialWorkspace,
  type EditorialEventInput, type EditorialMember, type PrimaryEvidence, type Reference,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ErrorState, Shimmer, VerificationBadge, VERIFICATION_LABEL, errorMessage } from "@/components/lkt/common";
import { EditorialHistory } from "./editorial-history";

type Status = Reference["verificationStatus"];
const field = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const lbl = "block text-xs font-semibold";

function isRealDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function isHttps(u: string) {
  try { return new URL(u).protocol === "https:"; } catch { return false; }
}
function statusOf(e: unknown): number | undefined {
  return typeof e === "object" && e && "status" in e && typeof (e as { status: unknown }).status === "number" ? (e as { status: number }).status : undefined;
}

export function EditorialWorkspacePanel() {
  const ws = useGetEditorialWorkspace({ query: { queryKey: getGetEditorialWorkspaceQueryKey(), refetchInterval: 60_000, staleTime: 60_000 } });
  const [openId, setOpenId] = useState<string | null>(null);

  if (ws.isLoading) return <section className="mb-8 space-y-2" data-testid="editorial-loading"><Shimmer className="h-10 w-1/3" /><Shimmer className="h-14" /><Shimmer className="h-14" /><Shimmer className="h-14" /></section>;
  if (ws.isError || !ws.data) return <section className="mb-8"><ErrorState title="Ruang kerja editorial belum bisa dimuat" error={ws.error} onRetry={() => ws.refetch()} /></section>;
  const { canEdit, members, references } = ws.data;
  const open = references.find((r) => r.id === openId) ?? null;

  return (
    <section data-testid="editorial-workspace" className="rise mb-8 overflow-hidden rounded-xl border border-card-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[hsl(var(--ink))] px-5 py-3 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">Ruang kerja editorial bersama</p>
          <h2 className="font-display text-lg font-bold">Jadwal dan temuan referensi</h2>
        </div>
        <span className="font-mono text-xs text-sky-100/80">{references.length} referensi · {references.filter((r) => r.reviewOverdue).length} lewat jadwal</span>
      </header>
      {!canEdit && (
        <p data-testid="editorial-readonly" className="flex items-start gap-2 border-b border-border bg-muted/60 px-5 py-3 text-xs">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Anda belum memiliki izin editor pustaka. Izin ini terpisah dari peran pemilik atau anggota perusahaan. Hubungi operator untuk pemberian akses redaksi; pustaka baca tetap tersedia dari halaman Referensi perusahaan.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-5 py-2 font-semibold">Referensi</th><th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2 font-semibold">Penanggung jawab</th><th className="px-3 py-2 font-semibold">Tinjau ulang (WIB)</th><th className="px-3 py-2 font-semibold">Revisi</th>{canEdit && <th className="px-5 py-2" />}</tr>
          </thead>
          <tbody>
            {references.map((r) => {
              const assignee = members.find((m) => m.userId === r.assigneeUserId)?.displayName;
              return (
                <tr key={r.id} data-testid={`row-editorial-${r.id}`} className={cn("border-b border-border last:border-0", openId === r.id && "bg-accent/30")}>
                  <td className="max-w-xs px-5 py-2.5"><p className="truncate font-semibold">{r.title}</p><p className="truncate text-muted-foreground">{r.publisher} · {r.sourceType === "primary" ? "primer" : "pendukung"}</p><EditorialHistory reference={r} /></td>
                  <td className="px-3 py-2.5"><VerificationBadge status={r.verificationStatus} /></td>
                  <td className="px-3 py-2.5">{assignee ?? <span className="text-muted-foreground">{r.editorialOwner}</span>}</td>
                  <td className="px-3 py-2.5 font-mono"><time dateTime={r.nextReviewAt}>{r.nextReviewAt}</time>{r.reviewOverdue && <span className="ml-2 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 font-sans font-semibold">Lewat jadwal</span>}</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">r{r.reviewHistory.length}</td>
                  {canEdit && <td className="px-5 py-2.5 text-right">
                    <button data-testid={`button-edit-editorial-${r.id}`} onClick={() => setOpenId(openId === r.id ? null : r.id)} className="inline-flex items-center gap-1 rounded-lg border border-input px-2.5 py-1 font-semibold hover:border-primary hover:text-primary">
                      <FilePenLine className="h-3.5 w-3.5" />{openId === r.id ? "Tutup" : "Catat"}
                    </button>
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && open && <EditorialForm key={open.id} reference={open} members={members} onClose={() => setOpenId(null)} />}
    </section>
  );
}

type Draft = { title: string; url: string; locator: string; finding: string };

function EditorialForm({ reference: r, members, onClose }: { reference: Reference; members: EditorialMember[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // Revision captured when the form opened; never updated silently.
  const [revision] = useState(r.reviewHistory.length);
  const [kind, setKind] = useState<"schedule" | "findings">("schedule");
  const [assignee, setAssignee] = useState(members.some((m) => m.userId === r.assigneeUserId) ? r.assigneeUserId ?? "" : "");
  const [nextReviewAt, setNext] = useState(r.nextReviewAt);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<Status>(r.verificationStatus);
  const [notes, setNotes] = useState(r.verificationNotes);
  const [applicability, setApplicability] = useState(r.applicability);
  const [period, setPeriod] = useState(r.effectivePeriod);
  const [standards, setStandards] = useState<string[]>(r.standards);
  const [stdDraft, setStdDraft] = useState("");
  const [sources, setSources] = useState<Draft[]>(r.primarySources.map((p) => ({ ...p })));
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState(false);
  const latestRevision = useMemo(() => r.reviewHistory.length, [r.reviewHistory.length]);

  const append = useAppendEditorialEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEditorialWorkspaceQueryKey() });
        qc.invalidateQueries({ queryKey: getGetReferencesQueryKey() });
        toast({ title: kind === "schedule" ? "Jadwal dicatat" : "Temuan dicatat" });
        onClose();
      },
      onError: (e) => {
        if (statusOf(e) === 409) { setConflict(true); qc.invalidateQueries({ queryKey: getGetEditorialWorkspaceQueryKey() }); }
        else toast({ variant: "destructive", title: "Pembaruan editorial gagal", description: errorMessage(e) });
      },
    },
  });

  const secondaryBlocked = r.sourceType === "secondary";
  const submit = () => {
    const errs: string[] = [];
    if (!assignee) errs.push("Pilih penanggung jawab dari daftar anggota.");
    if (!isRealDate(nextReviewAt)) errs.push("Tanggal tinjau ulang harus tanggal kalender yang valid.");
    if (!summary.trim()) errs.push("Ringkasan perubahan wajib diisi.");
    if (kind === "findings") {
      if (!notes.trim() || !applicability.trim() || !period.trim()) errs.push("Catatan verifikasi, cakupan, dan periode wajib diisi.");
      if (status === "verified_primary" && secondaryBlocked) errs.push("Sumber pendukung tidak dapat diberi status primer terverifikasi.");
      if (status === "verified_primary" && !sources.length) errs.push("Primer terverifikasi memerlukan minimal satu bukti sumber.");
      sources.forEach((s, i) => {
        if (!s.title.trim() || !s.locator.trim() || !s.finding.trim()) errs.push(`Bukti ${i + 1}: semua kolom wajib diisi.`);
        if (!isHttps(s.url.trim())) errs.push(`Bukti ${i + 1}: URL harus diawali https://.`);
      });
    }
    setErrors(errs);
    if (errs.length) return;
    const data: EditorialEventInput = { expectedRevision: revision, kind, assigneeUserId: assignee, nextReviewAt, changeSummary: summary.trim() };
    if (kind === "findings") {
      const ev: PrimaryEvidence[] = sources.map((s) => ({ title: s.title.trim(), url: s.url.trim(), locator: s.locator.trim(), finding: s.finding.trim() }));
      data.findings = { verificationStatus: status, verificationNotes: notes.trim(), applicability: applicability.trim(), effectivePeriod: period.trim(), standards, primarySources: ev };
    }
    append.mutate({ id: r.id, data });
  };

  const setSrc = (i: number, k: keyof Draft, v: string) => setSources((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const addStd = () => { const v = stdDraft.trim(); if (v && !standards.includes(v)) setStandards([...standards, v]); setStdDraft(""); };

  return (
    <div data-testid="form-editorial" className="border-t-2 border-primary bg-background/60 px-5 py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Catatan editorial · dibuka pada revisi r{revision}</p><h3 className="font-display text-base font-bold">{r.title}</h3></div>
        <button data-testid="button-close-editorial" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      {conflict && (
        <div role="alert" data-testid="editorial-conflict" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <p className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />Referensi ini diperbarui editor lain (formulir r{revision}, terbaru r{latestRevision}). Catatan Anda tidak disimpan.</p>
          <button data-testid="button-reload-editorial" onClick={onClose} className="inline-flex items-center gap-1 rounded-lg border border-input bg-card px-2.5 py-1 font-semibold hover:border-primary"><RefreshCw className="h-3.5 w-3.5" />Muat ulang data terbaru</button>
        </div>
      )}
      <div role="radiogroup" className="mb-4 inline-flex rounded-lg border border-input bg-card p-0.5 text-xs font-semibold">
        {([["schedule", "Jadwal saja", CalendarClock], ["findings", "Temuan baru", FilePenLine]] as const).map(([v, label, Icon]) => (
          <button key={v} role="radio" aria-checked={kind === v} data-testid={`toggle-kind-${v}`} onClick={() => setKind(v)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5", kind === v ? "bg-[hsl(var(--ink))] text-white" : "hover:text-primary")}><Icon className="h-3.5 w-3.5" />{label}</button>
        ))}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">{kind === "schedule" ? "Hanya mengubah penanggung jawab dan jadwal. Status dan temuan terakhir tetap; ini bukan klaim bahwa sumber telah ditinjau ulang." : "Mencatat hasil peninjauan baru. Tanggal, penulis, dan waktu pencatatan ditetapkan server."}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={lbl}>Penanggung jawab
          <select data-testid="select-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={cn(field, "mt-1")}>
            <option value="">Pilih anggota</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
          </select>
        </label>
        <label className={lbl}>Tinjau ulang berikutnya (kalender WIB, bukan tenggat hukum)
          <input type="date" data-testid="input-next-review" value={nextReviewAt} onChange={(e) => setNext(e.target.value)} className={cn(field, "mt-1 font-mono")} />
        </label>
        <label className={lbl}>Ringkasan perubahan
          <input data-testid="input-change-summary" maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} className={cn(field, "mt-1")} placeholder={kind === "schedule" ? "Mis. jadwal dipindah setelah rilis PSAK" : "Mis. pasal 5 diperiksa ulang"} />
        </label>
      </div>
      {kind === "findings" && (
        <div className="mt-4 space-y-3">
          <label className={lbl}>Status verifikasi
            <select data-testid="select-verification" value={status} onChange={(e) => setStatus(e.target.value as Status)} className={cn(field, "mt-1 md:w-72")}>
              {Object.entries(VERIFICATION_LABEL).map(([v, label]) => <option key={v} value={v} disabled={v === "verified_primary" && secondaryBlocked}>{label}{v === "verified_primary" && secondaryBlocked ? " (tidak untuk sumber pendukung)" : ""}</option>)}
            </select>
          </label>
          <label className={lbl}>Catatan dan batas verifikasi<textarea data-testid="input-verification-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(field, "mt-1")} /></label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={lbl}>Cakupan penerapan<textarea data-testid="input-applicability" rows={2} value={applicability} onChange={(e) => setApplicability(e.target.value)} className={cn(field, "mt-1")} /></label>
            <label className={lbl}>Periode berlaku<textarea data-testid="input-effective-period" rows={2} value={period} onChange={(e) => setPeriod(e.target.value)} className={cn(field, "mt-1")} /></label>
          </div>
          <div>
            <p className={lbl}>Standar</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {standards.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full border border-input bg-card px-2.5 py-1 text-xs">{s}<button data-testid={`button-remove-standard-${s}`} aria-label={`Hapus ${s}`} onClick={() => setStandards(standards.filter((x) => x !== s))}><X className="h-3 w-3" /></button></span>)}
              {!standards.length && <span className="text-xs text-muted-foreground">Tidak ditetapkan oleh sumber ini.</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <input data-testid="input-standard" value={stdDraft} maxLength={500} onChange={(e) => setStdDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStd(); } }} className={cn(field, "md:w-72")} placeholder="Mis. SAK Entitas Privat" />
              <button data-testid="button-add-standard" onClick={addStd} className="rounded-lg border border-input bg-card px-3 text-xs font-semibold hover:border-primary">Tambah</button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between"><p className={lbl}>Bukti sumber primer ({sources.length})</p>
              <button data-testid="button-add-evidence" disabled={sources.length >= 30} onClick={() => setSources([...sources, { title: "", url: "https://", locator: "", finding: "" }])} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Tambah bukti</button>
            </div>
            <div className="mt-2 space-y-2">
              {sources.map((s, i) => (
                <div key={i} data-testid={`evidence-${i}`} className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_1fr_auto]">
                  <input data-testid={`input-evidence-title-${i}`} placeholder="Judul sumber" value={s.title} onChange={(e) => setSrc(i, "title", e.target.value)} className={field} />
                  <input data-testid={`input-evidence-url-${i}`} placeholder="https://" value={s.url} onChange={(e) => setSrc(i, "url", e.target.value)} className={cn(field, "font-mono text-xs")} />
                  <button data-testid={`button-remove-evidence-${i}`} aria-label="Hapus bukti" onClick={() => setSources(sources.filter((_, j) => j !== i))} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  <input data-testid={`input-evidence-locator-${i}`} placeholder="Lokasi (pasal, halaman)" value={s.locator} onChange={(e) => setSrc(i, "locator", e.target.value)} className={field} />
                  <textarea data-testid={`input-evidence-finding-${i}`} rows={1} placeholder="Temuan" value={s.finding} onChange={(e) => setSrc(i, "finding", e.target.value)} className={cn(field, "md:col-span-2")} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {errors.length > 0 && <ul role="alert" data-testid="editorial-errors" className="mt-4 list-disc space-y-0.5 rounded-lg border border-destructive/40 bg-destructive/5 py-2 pl-7 pr-3 text-xs text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} data-testid="button-cancel-editorial" className="rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold">Batal</button>
        <button onClick={submit} disabled={append.isPending || conflict} data-testid="button-submit-editorial" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{append.isPending ? "Menyimpan..." : kind === "schedule" ? "Simpan jadwal" : "Catat temuan"}</button>
      </div>
    </div>
  );
}
export { EditorialWorkspacePanel as EditorialWorkspace };
