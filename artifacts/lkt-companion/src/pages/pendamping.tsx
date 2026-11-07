import { Link } from "wouter";
import { ArrowRight, BookMarked, FolderKanban, ShieldAlert, Users } from "lucide-react";
import { useGetConsultationSpecialists } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, Shimmer, useDocTitle } from "@/components/lkt/common";

export default function PendampingPage() {
  useDocTitle("Pendamping Spesialis");
  const catalog = useGetConsultationSpecialists();
  const profiles = catalog.data ?? [];
  const general = profiles.find((p) => p.id === "umum");
  const focused = profiles.filter((p) => p.id !== "umum");

  return (
    <>
      <PageHeader eyebrow="Asisten · fokus konsultasi" title="Pendamping spesialis">
        Pilih fokus percakapan sebelum bertanya. Setiap pendamping adalah AI yang sama dengan arahan topik yang lebih sempit, bukan profesional berlisensi dan bukan model yang dilatih khusus.
      </PageHeader>

      <div className="rise mb-6 flex gap-3 rounded-xl border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/10 p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(30_90%_35%)]" />
        <p><b>Bantuan edukatif, bukan nasihat profesional.</b> Tidak menggantikan akuntan publik, konsultan pajak, notaris, atau penasihat hukum. Tidak memeriksa sumber web secara langsung. Jangan kirim data keuangan atau pribadi yang sensitif.</p>
      </div>

      {catalog.isLoading ? (
        <div data-testid="state-catalog-loading" className="grid gap-4 md:grid-cols-2">
          <Shimmer className="h-40 md:col-span-2" /><Shimmer className="h-64" /><Shimmer className="h-64" />
        </div>
      ) : catalog.isError ? (
        <ErrorState title="Katalog pendamping belum bisa dimuat" error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : !profiles.length ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="Belum ada pendamping tersedia">Katalog kosong untuk ruang kerja ini. Anda tetap bisa memakai Konsultasi AI umum.</EmptyState>
      ) : (
        <div className="space-y-5">
          {focused.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-3">
              {focused.map((p, i) => (
                <article key={p.id} data-testid={`card-specialist-${p.id}`} style={{ animationDelay: `${i * 80}ms` }}
                  className="rise group flex flex-col rounded-2xl border border-card-border bg-card p-5 transition-all hover:-translate-y-1 hover:border-[hsl(var(--ink))] hover:shadow-[0_18px_40px_-24px_hsl(var(--ink)/.55)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Fokus 0{i + 1}</span>
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--ink))] font-display text-sm font-extrabold text-[hsl(var(--sidebar-primary))]">{p.label.charAt(0)}</span>
                  </div>
                  <h2 className="font-display mt-3 text-xl font-extrabold">{p.label}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/85">{p.summary}</p>
                  <div className="mt-4 rounded-lg border-l-[3px] border-[hsl(var(--signal))] bg-muted/60 px-3 py-2 text-xs leading-relaxed">
                    <p className="font-semibold uppercase tracking-wider text-[10px] text-[hsl(30_90%_28%)]">Batas</p>
                    <p className="mt-0.5">{p.boundary}</p>
                  </div>
                  {p.starters.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      {p.starters.slice(0, 3).map((s) => <li key={s} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{s}</li>)}
                    </ul>
                  )}
                  <p className="mt-3 font-mono text-[10px] text-muted-foreground">{p.referenceIds.length} catatan rujukan terkait</p>
                  <Link href={`/konsultasi?fokus=${p.id}`} data-testid={`link-consult-${p.id}`}
                    className="mt-5 inline-flex items-center justify-between gap-2 rounded-lg bg-[hsl(var(--ink))] px-4 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-primary">
                    Tanya dengan fokus ini <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </article>
              ))}
            </div>
          )}

          {general && (
            <section data-testid="card-specialist-umum" className={cn("rise ink-grid flex flex-col gap-4 rounded-2xl bg-sidebar p-6 text-sky-50 md:flex-row md:items-center")}>
              <div className="flex-1">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--sidebar-primary))]">Tidak yakin topiknya?</p>
                <h2 className="font-display mt-1 text-xl font-extrabold text-white">{general.label}</h2>
                <p className="mt-1 text-sm text-sky-100/85">{general.summary}</p>
                <p className="mt-2 text-xs text-sky-100/70"><b className="text-sky-50">Batas:</b> {general.boundary}</p>
              </div>
              <Link href="/konsultasi?fokus=umum" data-testid="link-consult-umum" className="inline-flex items-center gap-2 self-start rounded-lg bg-[hsl(var(--sidebar-primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--ink))] transition-transform hover:-translate-y-0.5 md:self-center">
                Mulai umum <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/ruang-laporan" data-testid="link-ruang-laporan" className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-4 text-sm font-semibold transition-colors hover:border-primary"><FolderKanban className="h-5 w-5 text-primary" /> Cek kesiapan di Ruang Laporan</Link>
            <Link href="/referensi" data-testid="link-referensi" className="flex items-center gap-3 rounded-xl border border-card-border bg-card p-4 text-sm font-semibold transition-colors hover:border-primary"><BookMarked className="h-5 w-5 text-primary" /> Telusuri pustaka Referensi</Link>
          </div>
        </div>
      )}
    </>
  );
}
