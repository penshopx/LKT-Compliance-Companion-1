import { Link } from "wouter";
import { ArrowRight, ClipboardList, History, Info } from "lucide-react";
import { useGetActivity, useGetCompany, useGetDashboard } from "@workspace/api-client-react";
import { EmptyState, ErrorState, KIND_LABEL, PageHeader, Shimmer, StatusPill, fmtDate, useDocTitle } from "@/components/lkt/common";

export default function DashboardPage() {
  useDocTitle("Ringkasan persiapan");
  const company = useGetCompany();
  const dash = useGetDashboard();
  const activity = useGetActivity();
  const d = dash.data;
  const pct = d ? Math.round(d.progress) : 0;

  return (
    <>
      <PageHeader eyebrow={company.data ? `Tahun buku ${company.data.year}` : "Ringkasan"} title={company.data ? `Persiapan LKT ${company.data.name}` : "Ringkasan persiapan"}>
        {company.data && <>Cakupan daftar persiapan mengikuti profil: <b className="text-foreground">{KIND_LABEL[company.data.kind]}</b>, standar <b className="text-foreground">{company.data.standard}</b>. </>}
        Ini peta kerja Anda, bukan sertifikat kepatuhan.
      </PageHeader>

      {dash.isError ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : (
        <section className="rise grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="ink-grid relative overflow-hidden rounded-2xl bg-[hsl(var(--ink))] p-6 text-white md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">Progres persiapan</p>
            {dash.isLoading || !d ? <div className="mt-4 h-16 w-40 animate-pulse rounded bg-white/10" /> : (
              <>
                <p data-testid="text-progress" className="font-display mt-2 text-7xl font-extrabold leading-none text-[hsl(var(--sidebar-primary))]">{pct}<span className="text-3xl text-sky-200">%</span></p>
                <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full origin-left rounded-full bg-[hsl(var(--sidebar-primary))] transition-transform duration-700" style={{ transform: `scaleX(${pct / 100})` }} />
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                  <Stat label="Siap" v={d.completed} />
                  <Stat label="Dikerjakan" v={d.inProgress} accent />
                  <Stat label="Total langkah" v={d.total} />
                </div>
                <p className="mt-5 flex items-start gap-2 text-xs text-sky-100/80"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Persentase menghitung langkah yang Anda tandai siap. Kepatuhan tetap perlu dinilai oleh akuntan atau penasihat yang berwenang.</p>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Tile href="/referensi" label="Referensi tersedia" v={d?.referenceCount} loading={dash.isLoading} />
            <Tile href="/konsultasi" label="Pesan konsultasi" v={d?.consultationCount} loading={dash.isLoading} />
            <Link href="/solusi" className="col-span-2 flex items-center justify-between rounded-2xl border border-card-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary">
              <div><p className="font-display font-bold">Menemui kendala?</p><p className="text-sm text-muted-foreground">Buka panduan solusi langkah demi langkah.</p></div>
              <ArrowRight className="h-5 w-5 text-primary" />
            </Link>
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Langkah berikutnya</h2>
            <Link href="/checklist" className="text-sm font-semibold text-primary hover:underline">Semua langkah</Link>
          </div>
          {dash.isLoading ? <div className="space-y-2">{[0, 1, 2].map((i) => <Shimmer key={i} className="h-20" />)}</div>
            : d && d.nextSteps.length === 0 ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Tidak ada langkah tertunda">Semua langkah dalam cakupan sudah Anda tandai siap. Tinjau kembali catatan sebelum diserahkan ke akuntan.</EmptyState>
            : <ol className="space-y-2">{d?.nextSteps.map((s, i) => (
              <li key={s.id} style={{ animationDelay: `${i * 60}ms` }} className="rise">
                <Link href="/checklist" data-testid={`card-next-${s.id}`} className="group flex items-start gap-4 rounded-xl border border-card-border bg-card p-4 transition-all hover:border-primary hover:shadow-[0_6px_20px_-12px_hsl(var(--primary))]">
                  <span className="font-mono text-sm font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                  </div>
                  <StatusPill status={s.status} />
                </Link>
              </li>))}</ol>}
        </div>
        <div>
          <h2 className="font-display mb-3 text-xl font-bold">Aktivitas terakhir</h2>
          {activity.isError ? <ErrorState error={activity.error} onRetry={() => activity.refetch()} />
            : activity.isLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-10" />)}</div>
            : !activity.data?.length ? <EmptyState icon={<History className="h-5 w-5" />} title="Belum ada aktivitas">Perubahan status, catatan, dan profil akan tercatat di sini.</EmptyState>
            : <ul className="relative space-y-4 border-l-2 border-border pl-5">{activity.data.slice(0, 10).map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                <p className="text-sm font-medium">{a.title}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{fmtDate(a.createdAt)}</p>
              </li>))}</ul>}
        </div>
      </section>
    </>
  );
}

function Stat({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return <div className="rounded-lg bg-white/5 p-3"><p className={`font-mono text-2xl font-semibold ${accent ? "text-[hsl(var(--signal))]" : "text-white"}`}>{v}</p><p className="text-xs text-sky-100/80">{label}</p></div>;
}

function Tile({ href, label, v, loading }: { href: string; label: string; v?: number; loading: boolean }) {
  return (
    <Link href={href} className="flex flex-col justify-between rounded-2xl border border-card-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? <Shimmer className="mt-4 h-9 w-12" /> : <p className="font-display mt-4 text-4xl font-extrabold">{v ?? 0}</p>}
    </Link>
  );
}
