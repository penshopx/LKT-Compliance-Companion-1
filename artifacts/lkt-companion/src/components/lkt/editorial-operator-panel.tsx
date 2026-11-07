import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import {
  getGetEditorialAccessQueryKey, getGetEditorialWorkspaceQueryKey, getGetOperatorStatusQueryKey,
  useGetEditorialAccess, useGetOperatorStatus, useGrantEditorialAccess, useRevokeEditorialAccess,
  type EditorialMember,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ErrorState, Shimmer, errorMessage } from "@/components/lkt/common";

const field = "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const lbl = "block text-xs font-semibold";
const fmt = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function EditorialOperatorPanel() {
  const status = useGetOperatorStatus({ query: { queryKey: getGetOperatorStatusQueryKey(), refetchInterval: 60_000 } });
  const isOperator = status.data?.canManageEditors === true;
  if (status.isLoading) return <Shimmer className="h-12" />;
  if (status.isError) return <ErrorState title="Status operator belum bisa diperiksa" error={status.error} onRetry={() => status.refetch()} />;
  if (!isOperator) return null;
  return <OperatorRoster />;
}

function OperatorRoster() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const access = useGetEditorialAccess({ query: { queryKey: getGetEditorialAccessQueryKey(), refetchInterval: 30_000 } });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [grantErr, setGrantErr] = useState<string | null>(null);
  const [target, setTarget] = useState<EditorialMember | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeErr, setRevokeErr] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: getGetEditorialAccessQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEditorialWorkspaceQueryKey() });
    qc.invalidateQueries({ queryKey: getGetOperatorStatusQueryKey() });
  };

  const grant = useGrantEditorialAccess({
    mutation: {
      onSuccess: (r) => {
        refresh();
        toast({ title: r.changed ? "Izin editor diberikan" : "Tidak ada perubahan", description: r.changed ? undefined : "Akun ini sudah memiliki izin editor." });
        setEmail(""); setName(""); setReason(""); setGrantErr(null);
      },
      onError: (e) => setGrantErr(errorMessage(e)),
    },
  });
  const revoke = useRevokeEditorialAccess({
    mutation: {
      onSuccess: (r) => {
        refresh();
        toast({ title: r.changed ? "Izin editor dicabut" : "Tidak ada perubahan", description: r.changed ? "Atribusi jurnal lama tetap tercatat atas nama editor." : "Akun ini sudah tidak memiliki izin editor." });
        setTarget(null); setRevokeReason(""); setRevokeErr(null);
      },
      onError: (e) => setRevokeErr(errorMessage(e)),
    },
  });

  const submitGrant = () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setGrantErr("Masukkan email akun yang valid.");
    if (!name.trim()) return setGrantErr("Nama tampilan wajib diisi.");
    if (!reason.trim()) return setGrantErr("Alasan pemberian izin wajib diisi.");
    setGrantErr(null);
    grant.mutate({ data: { email: e, displayName: name.trim(), reason: reason.trim() } });
  };
  const submitRevoke = () => {
    if (!target) return;
    if (!revokeReason.trim()) return setRevokeErr("Alasan pencabutan wajib diisi.");
    setRevokeErr(null);
    revoke.mutate({ data: { userId: target.userId, reason: revokeReason.trim() } });
  };

  return (
    <section data-testid="editorial-operator-panel" className="rise overflow-hidden rounded-xl border border-card-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[hsl(var(--ink))] px-5 py-3 text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200/80">Panel operator</p>
          <h2 className="font-display text-lg font-bold">Izin editor pustaka bersama</h2>
        </div>
        <ShieldCheck className="h-5 w-5 text-sky-200/80" />
      </header>
      {access.isLoading ? (
        <div className="space-y-2 p-5"><Shimmer className="h-10" /><Shimmer className="h-24" /></div>
      ) : access.isError || !access.data ? (
        <div className="p-5"><ErrorState title="Daftar editor belum bisa dimuat" error={access.error} onRetry={() => access.refetch()} /></div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 space-y-5 border-b border-border p-5 md:border-b-0 md:border-r">
            <div>
              <h3 className="mb-1 text-sm font-bold">Beri izin editor</h3>
              <p className="mb-3 text-xs text-muted-foreground">Hanya untuk akun yang sudah ada dengan email terverifikasi.</p>
              <div className="space-y-2">
                <label className={lbl}>Email akun<input data-testid="input-grant-email" type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className={cn(field, "mt-1")} /></label>
                <label className={lbl}>Nama tampilan<input data-testid="input-grant-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={cn(field, "mt-1")} /></label>
                <label className={lbl}>Alasan<textarea data-testid="input-grant-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={cn(field, "mt-1")} /></label>
                {grantErr && <p role="alert" data-testid="grant-error" className="text-xs text-destructive">{grantErr}</p>}
                <button data-testid="button-grant-editor" onClick={submitGrant} disabled={grant.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><UserPlus className="h-4 w-4" />{grant.isPending ? "Memproses..." : "Beri izin"}</button>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold">Editor aktif ({access.data.members.length})</h3>
              {access.data.members.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada editor.</p> : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {access.data.members.map((m) => (
                    <li key={m.userId} data-testid={`row-editor-${m.userId}`} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                      <div className="min-w-0"><p className="truncate font-semibold">{m.displayName}</p><p className="truncate font-mono text-muted-foreground">{m.userId}</p></div>
                      <button data-testid={`button-revoke-${m.userId}`} onClick={() => { setTarget(m); setRevokeReason(""); setRevokeErr(null); }} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-input px-2 py-1 font-semibold hover:border-destructive hover:text-destructive"><UserMinus className="h-3.5 w-3.5" />Cabut</button>
                    </li>
                  ))}
                </ul>
              )}
              {target && (
                <div role="alertdialog" aria-label={`Konfirmasi pencabutan ${target.displayName}`} data-testid="revoke-confirm" className="mt-3 min-w-0 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs [overflow-wrap:anywhere]">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="font-semibold">Cabut izin editor dari {target.displayName} ({target.userId})?</p>
                    <button aria-label="Batal" onClick={() => setTarget(null)}><X className="h-4 w-4" /></button>
                  </div>
                  <p className="mb-2 text-muted-foreground">Catatan jurnal yang sudah dibuat tetap mempertahankan atribusi nama editor ini.</p>
                  <label className={lbl}>Alasan pencabutan<textarea data-testid="input-revoke-reason" rows={2} maxLength={1000} value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} className={cn(field, "mt-1")} /></label>
                  {revokeErr && <p role="alert" className="mt-1 text-destructive">{revokeErr}</p>}
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    <button onClick={() => setTarget(null)} className="rounded-lg border border-input bg-card px-3 py-1.5 font-semibold">Batal</button>
                    <button data-testid="button-confirm-revoke" onClick={submitRevoke} disabled={revoke.isPending} className="rounded-lg bg-destructive px-3 py-1.5 font-semibold text-destructive-foreground disabled:opacity-50">{revoke.isPending ? "Memproses..." : `Cabut izin ${target.displayName}`}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 p-5 [overflow-wrap:anywhere]">
            <h3 className="mb-1 text-sm font-bold">Jejak audit izin</h3>
            <p className="mb-3 text-xs text-muted-foreground">Menampilkan 100 peristiwa terbaru, dari panel maupun CLI. Waktu dalam WIB.</p>
            {access.data.events.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada peristiwa.</p> : (
              <ol className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {access.data.events.slice(0, 100).map((ev) => (
                  <li key={ev.id} data-testid={`audit-${ev.id}`} className="rounded-lg border border-border p-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("rounded px-1.5 py-0.5 font-semibold", ev.action === "grant" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>{ev.action === "grant" ? "Beri izin" : "Cabut izin"}</span>
                      <span className="rounded border border-input px-1.5 py-0.5 font-mono uppercase">{ev.source}</span>
                      <span className="rounded border border-input px-1.5 py-0.5">peran {ev.role}</span>
                      <time dateTime={ev.createdAt} className="ml-auto font-mono text-muted-foreground">{fmt.format(new Date(ev.createdAt))}</time>
                    </div>
                    <p className="mt-1.5"><span className="text-muted-foreground">Oleh</span> <b>{ev.actorName}</b> <span className="font-mono text-muted-foreground">({ev.actorId})</span> <span className="text-muted-foreground">untuk</span> <b>{ev.targetName}</b> <span className="font-mono text-muted-foreground">({ev.targetUserId})</span></p>
                    <p className="mt-1 text-muted-foreground">Alasan: <span className="text-foreground">{ev.reason}</span></p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
