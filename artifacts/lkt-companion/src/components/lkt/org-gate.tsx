import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, ShieldAlert } from "lucide-react";
import { getGetLktAccountQueryKey, setLktOrganization, useGetLktAccount, type LktAccount, type Organization } from "@workspace/api-client-react";
import { OrgContext, ROLE_LABEL, errorStatus, type OrgContextValue } from "@/lib/org-context";
import { useToast } from "@/hooks/use-toast";
import { ErrorState, Shimmer } from "./common";
import { CreateCompanyForm, LegacyDiscard, UserBadge } from "./account-widgets";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (count, err) => { const s = errorStatus(err); return s !== 401 && s !== 403 && s !== 404 && count < 1; },
      },
    },
  });
}

/** Root scope: one QueryClient per Clerk user. Keyed by userId by the caller. */
export function AccountScope({ userId, children }: { userId: string; children: ReactNode }) {
  const [client] = useState(makeClient);
  useLayoutEffect(() => { setLktOrganization(null); }, []);
  return (
    <QueryClientProvider client={client}>
      <OrgGate userId={userId}>{children}</OrgGate>
    </QueryClientProvider>
  );
}

function OrgGate({ userId, children }: { userId: string; children: ReactNode }) {
  const rootClient = useQueryClient();
  const { toast } = useToast();
  const account = useGetLktAccount({ query: { queryKey: getGetLktAccountQueryKey(), refetchOnWindowFocus: true, refetchInterval: 60_000 } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [denied, setDenied] = useState<string[]>([]);
  const orgs = account.data?.organizations;
  const selected = selectedId ? orgs?.find((o) => o.id === selectedId) : undefined;

  // Remove stale company from selection when membership disappears.
  useEffect(() => {
    if (!selectedId || !orgs) return;
    if (!orgs.some((o) => o.id === selectedId)) {
      setSelectedId(null);
      toast({ title: "Akses perusahaan berakhir", description: "Anda tidak lagi menjadi anggota perusahaan tersebut.", variant: "destructive" });
    }
  }, [selectedId, orgs, toast]);

  // Auto-enter when exactly one usable company.
  useEffect(() => {
    if (selectedId || !orgs) return;
    const usable = orgs.filter((o) => !denied.includes(o.id));
    if (orgs.length === 1 && usable.length === 1) setSelectedId(usable[0].id);
  }, [selectedId, orgs, denied]);

  useLayoutEffect(() => { if (!selected) setLktOrganization(null); }, [selected]);

  const refreshAccount = useCallback(() => account.refetch(), [account.refetch]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectOrg = useCallback((id: string | null) => { setSelectedId(id); if (id) setDenied((d) => d.filter((x) => x !== id)); }, []);
  const denyOrg = useCallback((id: string) => { setDenied((d) => (d.includes(id) ? d : [...d, id])); setSelectedId(null); void account.refetch(); }, [account.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account.data) {
    return (
      <div className="mx-auto min-h-[100dvh] max-w-3xl px-4 py-12">
        {account.isError ? (
          <div className="space-y-4">
            <ErrorState title="Akun LKTara belum bisa dimuat" error={account.error} onRetry={() => account.refetch()} />
            <UserBadge tone="light" />
          </div>
        ) : (
          <div data-testid="state-account-loading" className="space-y-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">Memeriksa keanggotaan perusahaan...</p>
            <Shimmer className="h-12 w-2/3" /><Shimmer className="h-40" />
          </div>
        )}
      </div>
    );
  }

  if (!selected) {
    return <CompanyPicker account={account.data} denied={denied} rootClient={rootClient} refreshAccount={refreshAccount} onSelect={selectOrg} />;
  }

  return (
    <Workspace key={`${userId}:${selected.id}`} value={{ userId, account: account.data, org: selected, rootClient, refreshAccount, selectOrg, denyOrg }}>
      {children}
    </Workspace>
  );
}

function Workspace({ value, children }: { value: OrgContextValue; children: ReactNode }) {
  // Header must be set synchronously before any workspace query mounts.
  const orgId = value.org.id;
  const [client] = useState(() => { setLktOrganization(orgId); return makeClient(); });
  setLktOrganization(orgId);
  return (
    <OrgContext.Provider value={value}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </OrgContext.Provider>
  );
}

function CompanyPicker({ account, denied, rootClient, refreshAccount, onSelect }: {
  account: LktAccount; denied: string[]; rootClient: QueryClient; refreshAccount: () => Promise<unknown>; onSelect: (id: string) => void;
}) {
  const hasOrgs = account.organizations.length > 0;
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="ink-grid bg-sidebar px-4 py-4 md:px-10">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="LKTara" className="h-9 rounded-md bg-sky-50 px-2 py-1" />
          <UserBadge compact />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 md:px-10">
        <p className="rise font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{hasOrgs ? "Pilih ruang kerja" : "Langkah pertama"}</p>
        <h1 className="rise font-display mt-2 text-3xl font-extrabold md:text-[2.4rem] md:leading-[1.05]">
          {hasOrgs ? "Masuk ke perusahaan mana hari ini?" : "Buat ruang kerja perusahaan Anda"}
        </h1>
        <p className="rise mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Semua profil, daftar persiapan, referensi, dan konsultasi disimpan per perusahaan, hanya untuk anggota tim yang terdaftar.
        </p>

        {hasOrgs && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {account.organizations.map((o: Organization) => {
              const isDenied = denied.includes(o.id);
              return (
                <button key={o.id} data-testid={`button-select-org-${o.id}`} onClick={() => onSelect(o.id)}
                  className="group rise flex items-center gap-3 rounded-xl border border-card-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[hsl(var(--ink))] text-[hsl(var(--sidebar-primary))]"><Building2 className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[o.role]}</p>
                    {isDenied && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-destructive"><ShieldAlert className="h-3 w-3" /> Akses ditolak terakhir kali. Coba lagi?</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </button>
              );
            })}
          </div>
        )}

        <section className="mt-10 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-card-border bg-card p-5 md:p-6">
            <h2 className="font-display text-xl font-bold">{hasOrgs ? "Atau buat perusahaan baru" : "Perusahaan baru"}</h2>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">Anda menjadi pemilik dan dapat menambahkan rekan tim lewat ID akun mereka.</p>
            <CreateCompanyForm client={rootClient} legacyAvailable={account.legacyAvailable} refreshAccount={refreshAccount} onCreated={(o) => onSelect(o.id)} />
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-card-border bg-card p-4">
              <p className="text-sm font-semibold">Diundang oleh rekan?</p>
              <p className="mt-1 text-sm text-muted-foreground">Bagikan ID akun ini kepada pemilik perusahaan agar Anda ditambahkan.</p>
              <p data-testid="text-account-id" className="mt-2 select-all break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{account.userId}</p>
            </div>
            {account.legacyAvailable && <LegacyDiscard client={rootClient} refreshAccount={refreshAccount} />}
          </div>
        </section>
      </main>
    </div>
  );
}
