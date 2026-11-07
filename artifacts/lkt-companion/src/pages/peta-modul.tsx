import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AlertTriangle, ArrowRight, Ban, Compass, Lock, Search, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, useDocTitle } from "@/components/lkt/common";
import { ROLE_PATHS, WORK_MODULES, parseWorkRole, selectWorkModules, type ModuleAvailability, type WorkRole } from "@/lib/module-map";

type StatusFilter = "semua" | ModuleAvailability;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "tersedia", label: "Tersedia" },
  { value: "sebagian", label: "Sebagian" },
];
const ROLES = Object.keys(ROLE_PATHS) as WorkRole[];

function parseStatus(v: string | null): StatusFilter {
  return v === "tersedia" || v === "sebagian" ? v : "semua";
}

function stepNote(href: string) {
  return href === "/ruang-laporan" ? "Pilih tahun buku dulu di Ruang Laporan" : href.startsWith("/konsultasi") ? "Membuka pemilih fokus; tidak mengirim pertanyaan" : null;
}

export default function PetaModulPage() {
  useDocTitle("Peta Modul");
  useEffect(() => {
    const description = "Temukan modul kerja LKTara untuk penyusunan, penelaahan internal, dan pimpinan tanpa mengubah izin akses perusahaan.";
    const entries: [string, string, string][] = [
      ["name", "description", description],
      ["property", "og:title", "Peta Modul | LKTara"],
      ["property", "og:description", description],
    ];
    const restore = entries.map(([attribute, key, content]) => {
      let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      const existed = !!tag;
      const previous = tag?.getAttribute("content") ?? "";
      if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, key); document.head.appendChild(tag); }
      tag.setAttribute("content", content);
      const element = tag;
      return () => { if (existed) element.setAttribute("content", previous); else element.remove(); };
    });
    return () => restore.forEach(fn => fn());
  }, []);
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const rawRole = params.get("peran");
  const { role, invalid } = parseWorkRole(rawRole);
  const q = params.get("q") ?? "";
  const status = parseStatus(params.get("status"));
  const path = ROLE_PATHS[role];
  const modules = useMemo(() => selectWorkModules(q, status, role), [q, status, role]);
  const filtered = q.trim() !== "" || status !== "semua";

  const update = (next: { peran?: string; q?: string; status?: StatusFilter }, replace: boolean) => {
    const p = new URLSearchParams(search);
    if (next.peran !== undefined) p.set("peran", next.peran);
    if (next.q !== undefined) { if (next.q) p.set("q", next.q); else p.delete("q"); }
    if (next.status !== undefined) { if (next.status !== "semua") p.set("status", next.status); else p.delete("status"); }
    const s = p.toString();
    navigate(`/peta-modul${s ? `?${s}` : ""}`, { replace });
  };
  const clearFilters = () => update({ q: "", status: "semua" }, true);

  return (
    <>
      <PageHeader eyebrow="Navigasi · peta kerja" title="Peta modul">
        Temukan langkah persiapan berikutnya. Sudut pandang di bawah hanya mengatur urutan rekomendasi, bukan hak akses. Status modul menunjukkan fungsi yang sudah dibangun di aplikasi, bukan kesehatan layanan atau kemutakhiran hukum.
      </PageHeader>

      <section aria-label="Batas peta modul" data-testid="panel-boundaries" className="rise mb-6 grid gap-2 rounded-xl border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/10 p-4 text-sm sm:grid-cols-3">
        {[
          "Mengganti sudut pandang tidak memberi atau mencabut izin apa pun.",
          "Membuka modul tidak mengubah perusahaan atau tahun buku aktif.",
          "Kemajuan yang diisi sendiri dan penutupan temuan internal bukan audit atau bukti kepatuhan.",
        ].map((t) => (
          <p key={t} className="flex gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(30_90%_35%)]" aria-hidden />{t}</p>
        ))}
      </section>

      {invalid && (
        <div role="alert" data-testid="alert-invalid-role" className="mb-5 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="min-w-0 break-words">Sudut pandang "<span className="font-mono">{rawRole}</span>" tidak dikenal. Menampilkan jalur {ROLE_PATHS.penyusun.label}.</p>
        </div>
      )}

      <section className="rise ink-grid mb-8 rounded-2xl bg-sidebar p-5 text-sky-50 md:p-7">
        <div role="radiogroup" aria-label="Sudut pandang navigasi" className="flex flex-wrap gap-2">
          {ROLES.map((r) => {
            const active = r === role;
            return (
              <button key={r} role="radio" aria-checked={active} data-testid={`button-role-${r}`}
                onClick={() => !active || invalid ? update({ peran: r }, false) : undefined}
                className={cn("rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sidebar-primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--sidebar))]",
                  active ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--ink))]" : "bg-sidebar-accent text-sky-50 hover:bg-white/15")}>
                {ROLE_PATHS[r].label}
              </button>
            );
          })}
        </div>
        <p className="mt-4 max-w-2xl text-[15px] text-sky-100/90" data-testid="text-role-purpose"><b className="text-white">{path.label}:</b> {path.purpose}</p>
        <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label={`Langkah ${path.label}`}>
          {path.steps.map((s, i) => {
            const note = stepNote(s.href);
            return (
              <li key={`${s.title}-${i}`}>
                <Link href={s.href} data-testid={`link-step-${i}`}
                  className="group flex h-full flex-col rounded-xl border border-sidebar-border bg-sidebar-accent/80 p-4 transition-colors hover:border-[hsl(var(--sidebar-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sidebar-primary))]">
                  <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-[hsl(var(--sidebar-primary))]">LANGKAH {i + 1}</span>
                  <span className="font-display mt-1 text-lg font-bold text-white">{s.title}</span>
                  <span className="mt-1 text-sm text-sky-100/85">{s.detail}</span>
                  {note && <span className="mt-2 text-xs font-semibold text-[hsl(var(--signal))]">{note}</span>}
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-[hsl(var(--sidebar-primary))]">Buka <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-1" aria-hidden /></span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="modul-heading">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id="modul-heading" className="font-display text-2xl font-extrabold">Semua modul kerja</h2>
            <p className="text-sm text-muted-foreground">Keenam modul tetap terbuka untuk semua anggota. Yang relevan bagi {path.label} ditandai dan didahulukan.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block min-w-0 sm:w-72">
              <span className="sr-only">Cari modul berdasarkan tugas atau kata kunci</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input type="search" value={q} data-testid="input-search-modules" placeholder="Cari tugas: rekonsiliasi, SPT, temuan..."
                onChange={(e) => update({ q: e.target.value }, true)}
                className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <div role="radiogroup" aria-label="Filter status fungsi" className="flex rounded-lg border border-input bg-card p-0.5">
              {STATUS_OPTIONS.map((o) => (
                <button key={o.value} role="radio" aria-checked={status === o.value} data-testid={`button-status-${o.value}`}
                  onClick={() => update({ status: o.value }, true)}
                  className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    status === o.value ? "bg-[hsl(var(--ink))] text-white" : "text-foreground hover:bg-muted")}>{o.label}</button>
              ))}
            </div>
            {filtered && (
              <button onClick={clearFilters} data-testid="button-clear-filters" className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-3.5 w-3.5" aria-hidden /> Hapus filter
              </button>
            )}
          </div>
        </div>
        <p aria-live="polite" className="mb-3 font-mono text-xs text-muted-foreground" data-testid="text-result-count">{modules.length} dari {WORK_MODULES.length} modul</p>

        {modules.length === 0 ? (
          <div data-testid="state-empty" className="flex flex-col items-center rounded-2xl border border-dashed border-input bg-card/60 px-6 py-12 text-center">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--ink))] text-[hsl(var(--sidebar-primary))]"><Compass className="h-5 w-5" aria-hidden /></div>
            <p className="font-display text-lg font-bold">Tidak ada modul yang cocok</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Coba kata lain seperti "pajak", "temuan", atau "referensi". Sudut pandang {path.label} tetap dipertahankan.</p>
            <button onClick={clearFilters} data-testid="button-reset-empty" className="mt-5 rounded-lg bg-[hsl(var(--ink))] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Hapus pencarian dan filter</button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {modules.map((m) => {
              const rec = path.modules.includes(m.id);
              return (
                <article key={m.id} data-testid={`card-module-${m.id}`}
                  className={cn("flex min-w-0 flex-col rounded-2xl border bg-card p-5", rec ? "border-[hsl(var(--ink))] shadow-[0_14px_30px_-22px_hsl(var(--ink)/.6)]" : "border-card-border")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {rec && <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">Disarankan untuk {path.label}</span>}
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                      m.availability === "tersedia" ? "bg-[hsl(var(--ok))] text-white" : "bg-[hsl(var(--signal))] text-[hsl(var(--ink))]")}>
                      Fungsi {m.availability === "tersedia" ? "tersedia" : "sebagian"}
                    </span>
                  </div>
                  <h3 className="font-display mt-3 text-xl font-extrabold">{m.title}</h3>
                  <p className="mt-1 text-sm text-foreground/85">{m.description}</p>
                  {m.id === "dokumen-bukti" && (
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <p className="rounded-lg bg-accent p-2.5"><b>Arsip regulasi publik:</b> salinan sumber peraturan di Referensi, Riwayat temuan. Dibagikan di pustaka, bukan milik perusahaan.</p>
                      <p className="rounded-lg bg-muted p-2.5"><b>Dokumen privat perusahaan:</b> berkas keuangan per tahun buku. Penyimpanannya belum dibangun.</p>
                    </div>
                  )}
                  <ul className="mt-4 space-y-2">
                    {m.capabilities.map((c) => (
                      <li key={c.title} className={cn("rounded-xl border p-3", c.available ? "border-card-border" : "border-dashed border-input bg-muted/50")}>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{c.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                          </div>
                          {c.available && c.href ? (
                            <Link href={c.href} data-testid={`link-cap-${m.id}-${c.title}`}
                              className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-[hsl(var(--ink))] px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {c.action ?? "Buka"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          ) : (
                            <span data-testid={`status-unavailable-${m.id}`} className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg border border-input px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                              <Ban className="h-3.5 w-3.5" aria-hidden /> Belum tersedia
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex gap-2 border-l-[3px] border-[hsl(var(--signal))] pl-3 text-xs leading-relaxed">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(30_90%_35%)]" aria-hidden /><span><b>Batas:</b> {m.boundary}</span>
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
