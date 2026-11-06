import { useEffect, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export const KIND_LABEL: Record<string, string> = {
  nonpublik: "Perusahaan nonpublik",
  umkm: "UMKM",
  publik: "Emiten / perusahaan publik",
  kjpp: "Kantor Jasa Penilai Publik (KJPP)",
};

export const STATUS_LABEL: Record<string, string> = {
  belum: "Belum mulai",
  proses: "Sedang dikerjakan",
  selesai: "Siap",
};

export function useDocTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | LKTara`;
  }, [title]);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold text-foreground md:text-[2.6rem] md:leading-[1.05]">{title}</h1>
        {children && <div className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function ErrorState({ title = "Data belum bisa dimuat", error, onRetry }: { title?: string; error: unknown; onRetry?: () => void }) {
  return (
    <div data-testid="state-error" className="rise flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5 sm:flex-row sm:items-center">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <div className="flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 break-words font-mono text-xs text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <button data-testid="button-retry" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--ink))] px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
          <RotateCw className="h-4 w-4" /> Coba lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div data-testid="state-empty" className="rise flex flex-col items-center rounded-2xl border border-dashed border-input bg-card/60 px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--ink))] text-[hsl(var(--sidebar-primary))]">{icon}</div>
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted", className)}>
      <div className="scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls =
    status === "selesai"
      ? "bg-[hsl(var(--ok))] text-white"
      : status === "proses"
        ? "bg-[hsl(var(--signal))] text-[hsl(var(--ink))]"
        : "bg-secondary text-secondary-foreground";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", cls)}>{STATUS_LABEL[status] ?? status}</span>;
}

export function UnverifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/15 px-2 py-0.5 text-[11px] font-semibold text-[hsl(30_90%_28%)]">
      Belum diverifikasi
    </span>
  );
}

export function fmtDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}
