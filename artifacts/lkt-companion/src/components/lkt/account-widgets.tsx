import { useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { useClerk, useUser } from "@clerk/react";
import { AlertTriangle, Building2, Loader2, LogOut, Plus, Trash2 } from "lucide-react";
import { useCreateLktOrganization, useDeleteLktLegacy, type Organization } from "@workspace/api-client-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorMessage } from "./common";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function UserBadge({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const name = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Pengguna";
  const email = user?.primaryEmailAddress?.emailAddress;
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "U";
  const dark = tone === "dark";
  return (
    <div className={cn("flex items-center gap-2.5", compact ? "" : "rounded-xl border p-2.5", dark ? "border-sidebar-border" : "border-card-border bg-card")}>
      <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold", dark ? "bg-sidebar-accent text-[hsl(var(--sidebar-primary))]" : "bg-[hsl(var(--ink))] text-[hsl(var(--sidebar-primary))]")}>{initials}</div>
      {!compact && (
        <div className="min-w-0 flex-1 leading-tight">
          <p data-testid="text-user-name" className={cn("truncate text-[13px] font-semibold", dark ? "text-white" : "text-foreground")}>{name}</p>
          {email && <p className={cn("truncate text-[11px]", dark ? "text-sky-100/70" : "text-muted-foreground")}>{email}</p>}
        </div>
      )}
      <button
        data-testid="button-sign-out"
        disabled={busy}
        onClick={async () => { setBusy(true); await signOut({ redirectUrl: basePath || "/" }); }}
        title="Keluar"
        className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
          dark ? "bg-sidebar-accent text-sky-50 hover:bg-white/10" : "bg-muted text-foreground hover:bg-secondary")}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
        Keluar
      </button>
    </div>
  );
}

export function CreateCompanyForm({ client, legacyAvailable, refreshAccount, onCreated }: {
  client: QueryClient; legacyAvailable: boolean; refreshAccount: () => Promise<unknown>; onCreated: (org: Organization) => void;
}) {
  const create = useCreateLktOrganization(undefined, client);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [importLegacy, setImportLegacy] = useState(false);
  const [confirmOwn, setConfirmOwn] = useState(false);
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 160 && (!importLegacy || confirmOwn) && !create.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const org = await create.mutateAsync({ data: { name: trimmed, importLegacy: legacyAvailable && importLegacy, confirmLegacyOwnership: legacyAvailable && importLegacy && confirmOwn } });
      await refreshAccount();
      toast({ title: "Perusahaan dibuat", description: `${org.name} siap dipakai tim Anda.` });
      setName(""); setImportLegacy(false); setConfirmOwn(false);
      onCreated(org);
    } catch { /* error shown below */ }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4" data-testid="form-create-company">
      <div>
        <label htmlFor="company-name" className="text-sm font-semibold">Nama perusahaan</label>
        <input id="company-name" data-testid="input-company-name" value={name} maxLength={160} onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: PT Sinar Rasa Nusantara"
          className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/40" />
      </div>

      {legacyAvailable && (
        <div className="rounded-xl border border-[hsl(var(--signal))]/50 bg-[hsl(var(--signal))]/10 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox data-testid="checkbox-import-legacy" checked={importLegacy} onCheckedChange={(v) => { setImportLegacy(v === true); if (v !== true) setConfirmOwn(false); }} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-semibold">Pindahkan data lama dari peramban ini ke perusahaan baru</span>
              <span className="mt-0.5 block text-muted-foreground">Opsional. Data lama tidak pernah dipindahkan atau ditampilkan otomatis.</span>
            </span>
          </label>
          {importLegacy && (
            <div className="rise mt-3 space-y-3 border-t border-[hsl(var(--signal))]/40 pt-3">
              <p className="flex gap-2 text-[13px] leading-relaxed text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--signal))]" />
                Jika peramban ini pernah dipakai bersama, data lama bisa saja milik orang atau perusahaan lain. Setelah dipindahkan, seluruh anggota tim yang Anda tambahkan kemudian akan dapat melihat profil, daftar persiapan, penanda referensi, aktivitas, dan riwayat konsultasi tersebut.
              </p>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox data-testid="checkbox-confirm-legacy" checked={confirmOwn} onCheckedChange={(v) => setConfirmOwn(v === true)} className="mt-0.5" />
                <span className="text-sm font-semibold">Saya menyatakan data peramban ini milik saya dan perusahaan ini, dan saya setuju data tersebut terlihat oleh tim.</span>
              </label>
            </div>
          )}
        </div>
      )}

      {create.isError && <p data-testid="text-create-error" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(create.error)}</p>}

      <button type="submit" data-testid="button-create-company" disabled={!canSubmit}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Buat perusahaan
      </button>
    </form>
  );
}

export function LegacyDiscard({ client, refreshAccount }: { client: QueryClient; refreshAccount: () => Promise<unknown> }) {
  const del = useDeleteLktLegacy(undefined, client);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="panel-legacy" className="rounded-xl border border-card-border bg-card p-4">
      <p className="flex items-center gap-2 font-semibold"><Building2 className="h-4 w-4 text-[hsl(var(--signal))]" /> Ada data lama dari versi per peramban</p>
      <p className="mt-1 text-sm text-muted-foreground">Data ini tidak ditampilkan. Anda bisa memindahkannya saat membuat perusahaan baru, atau membuangnya.</p>
      {del.isError && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(del.error)}</p>}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <button data-testid="button-discard-legacy" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5">
            <Trash2 className="h-4 w-4" /> Buang data lama
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buang data lama secara permanen?</AlertDialogTitle>
            <AlertDialogDescription>
              Profil, daftar persiapan, penanda referensi, aktivitas, dan riwayat konsultasi dari versi per peramban akan dihapus permanen dan tidak bisa dipindahkan lagi ke perusahaan mana pun.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-discard-legacy" className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  await del.mutateAsync();
                  setOpen(false);
                  toast({ title: "Data lama dibuang" });
                  await refreshAccount();
                } catch { setOpen(false); }
              }}>
              {del.isPending ? "Menghapus..." : "Ya, buang permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
