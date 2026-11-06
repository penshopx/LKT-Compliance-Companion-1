import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeftRight, BookMarked, Building2, ClipboardList, LayoutGrid, LifeBuoy, MessagesSquare, ShieldAlert, Users } from "lucide-react";
import { useGetCompany } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, errorStatus, useOrg } from "@/lib/org-context";
import { UserBadge } from "./account-widgets";
import { ErrorState, KIND_LABEL, Shimmer } from "./common";

const NAV = [
  { href: "/ringkasan", label: "Ringkasan", icon: LayoutGrid },
  { href: "/checklist", label: "Daftar Persiapan", icon: ClipboardList },
  { href: "/solusi", label: "Solusi Masalah", icon: LifeBuoy },
  { href: "/referensi", label: "Referensi", icon: BookMarked },
  { href: "/konsultasi", label: "Konsultasi AI", icon: MessagesSquare },
  { href: "/perusahaan", label: "Profil Perusahaan", icon: Building2 },
  { href: "/akun", label: "Tim & Akun", icon: Users },
];

function Mark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--sidebar-primary))]">
        <span className="font-display text-lg font-extrabold text-[hsl(var(--ink))]">L</span>
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--signal))] ring-2 ring-[hsl(var(--ink))]" />
      </div>
      <div className="leading-none">
        <p className="font-display text-xl font-extrabold text-white">LKTara</p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-200/80">Pendamping LKT</p>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const company = useGetCompany();
  const { org, account, selectOrg, denyOrg } = useOrg();
  const forbidden = company.isError && errorStatus(company.error) === 403;
  const isActive = (href: string) => loc.startsWith(href);
  const others = account.organizations.filter((o) => o.id !== org.id);

  return (
    <div className="min-h-[100dvh] bg-background md:flex">
      <aside className="ink-grid sticky top-0 hidden h-[100dvh] w-[264px] shrink-0 flex-col bg-sidebar p-5 text-sidebar-foreground md:flex">
        <Mark />
        <Link href="/perusahaan" data-testid="link-company-card" className="mt-7 block rounded-xl border border-sidebar-border bg-sidebar-accent/80 p-3.5 transition-colors hover:border-[hsl(var(--sidebar-primary))]/60">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-200/70">Perusahaan · {ROLE_LABEL[org.role]}</p>
          <p data-testid="text-org-name" className="mt-0.5 truncate text-[12px] text-sky-100/80">{org.name}</p>
          {company.isLoading ? (
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-white/10" />
          ) : company.data ? (
            <>
              <p data-testid="text-company-name" className="mt-1 truncate font-semibold text-white">{company.data.name}</p>
              <p className="mt-0.5 truncate text-xs text-sky-100/80">
                Tahun buku <span className="font-mono font-semibold text-[hsl(var(--sidebar-primary))]">{company.data.year}</span> · {KIND_LABEL[company.data.kind]}
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-red-300">Profil gagal dimuat</p>
          )}
        </Link>
        {others.length > 0 && (
          <select data-testid="select-switch-org" value="" onChange={(e) => e.target.value && selectOrg(e.target.value)}
            className="mt-2 w-full rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-1.5 text-xs text-sky-50 outline-none">
            <option value="">Ganti perusahaan...</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} data-testid={`link-nav-${href.replace("/", "")}`}
                className={cn("group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-all",
                  active ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--ink))]" : "text-sky-50/85 hover:bg-sidebar-accent hover:text-white")}>
                <Icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-110", active && "stroke-[2.4]")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-sidebar-border p-3.5 text-[12px] leading-relaxed text-sky-100/80">
            <p className="flex items-center gap-1.5 font-semibold text-white"><ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--signal))]" /> Batas ruang kerja tim</p>
            <p className="mt-1">Data hanya terlihat oleh anggota {org.name}. Konsultasi AI diproses layanan pihak ketiga: jangan kirim data keuangan atau pribadi yang sensitif.</p>
          </div>
          <UserBadge />
        </div>
      </aside>

      <div className="sticky top-0 z-30 bg-sidebar px-4 pb-2 pt-3 md:hidden">
        <div className="flex items-center justify-between gap-2"><Mark /><UserBadge compact /></div>
        <Link href="/akun" className="mt-2 flex items-center gap-1.5 text-xs text-sky-100/85"><ArrowLeftRight className="h-3 w-3" /><span className="truncate font-semibold text-white">{org.name}</span> · {ROLE_LABEL[org.role]}</Link>
        <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={cn("whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold",
              isActive(href) ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--ink))]" : "bg-sidebar-accent text-sky-50")}>{label}</Link>
          ))}
        </nav>
      </div>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-12">
          {company.isSuccess ? children : forbidden ? (
            <div data-testid="state-forbidden" className="rise rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
              <p className="font-display text-xl font-bold">Akses ke {org.name} ditolak</p>
              <p className="mt-1 text-sm text-muted-foreground">Keanggotaan Anda mungkin telah dicabut atau perusahaan dihapus. Pilih perusahaan lain atau buat yang baru.</p>
              <button data-testid="button-choose-other-org" onClick={() => denyOrg(org.id)} className="mt-4 rounded-lg bg-[hsl(var(--ink))] px-4 py-2 text-sm font-semibold text-white">Pilih perusahaan lain</button>
            </div>
          ) : company.isError ? (
            <ErrorState title="Ruang kerja perusahaan belum bisa disiapkan" error={company.error} onRetry={() => company.refetch()} />
          ) : (
            <div data-testid="state-workspace-loading" className="space-y-4">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Menyiapkan ruang kerja perusahaan...</p>
              <Shimmer className="h-12 w-2/3" /><Shimmer className="h-48" /><Shimmer className="h-24" />
            </div>
          )}
        </div>
        <p className="px-4 pb-6 text-center text-xs text-muted-foreground md:hidden">Data hanya untuk anggota tim perusahaan ini. Jangan kirim data sensitif ke Konsultasi AI.</p>
      </main>
    </div>
  );
}
