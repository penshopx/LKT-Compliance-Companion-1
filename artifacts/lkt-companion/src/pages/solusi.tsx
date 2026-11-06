import { useMemo, useState } from "react";
import { ExternalLink, LifeBuoy, Search } from "lucide-react";
import { useGetProblems, useGetReferences } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, Shimmer, VerificationBadge, useDocTitle } from "@/components/lkt/common";

export default function SolusiPage() {
  useDocTitle("Solusi masalah");
  const probs = useGetProblems();
  const refs = useGetReferences();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (probs.data ?? []).filter((p) => !s || `${p.title} ${p.description} ${p.category} ${p.steps.join(" ")}`.toLowerCase().includes(s));
  }, [probs.data, q]);
  const active = list.find((p) => p.id === sel) ?? list[0];

  return (
    <>
      <PageHeader eyebrow="Panduan" title="Solusi masalah">Pilih kendala yang paling mirip dengan situasi Anda, lalu ikuti langkahnya satu per satu.</PageHeader>
      <label className="rise mb-6 flex items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input data-testid="input-search-problems" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Contoh: bukti transaksi hilang, rekonsiliasi bank" className="h-11 flex-1 bg-transparent text-sm outline-none" />
      </label>
      {probs.isError ? <ErrorState error={probs.error} onRetry={() => probs.refetch()} />
        : probs.isLoading ? <div className="grid gap-4 md:grid-cols-[320px_1fr]"><Shimmer className="h-72" /><Shimmer className="h-72" /></div>
        : !list.length || !active ? <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="Panduan tidak ditemukan">Coba kata lain, atau tanyakan di Konsultasi AI.</EmptyState>
        : <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <ul className="space-y-1.5 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
            {list.map((p) => (
              <li key={p.id}>
                <button data-testid={`button-problem-${p.id}`} onClick={() => setSel(p.id)} className={cn("w-full rounded-lg border px-4 py-3 text-left transition-all", active.id === p.id ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white" : "border-card-border bg-card hover:border-primary")}>
                  <p className={cn("text-[10px] font-semibold uppercase tracking-wider", active.id === p.id ? "text-[hsl(var(--sidebar-primary))]" : "text-primary")}>{p.category}</p>
                  <p className="mt-0.5 text-sm font-semibold">{p.title}</p>
                </button>
              </li>))}
          </ul>
          <article key={active.id} className="rise rounded-2xl border border-card-border bg-card p-6 md:p-8">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{active.category}</p>
            <h2 className="font-display mt-1 text-2xl font-extrabold">{active.title}</h2>
            <p className="mt-2 text-muted-foreground">{active.description}</p>
            <ol className="mt-6 space-y-3">
              {active.steps.map((s, i) => (
                <li key={i} style={{ animationDelay: `${i * 70}ms` }} className="rise flex gap-4">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{i + 1}</span>
                  <p className="pt-0.5 text-[15px] leading-relaxed">{s}</p>
                </li>))}
            </ol>
            {active.referenceIds.length > 0 && (
              <div className="mt-8 border-t border-border pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Referensi terkait</p>
                {refs.isError && <ErrorState title="Referensi belum bisa dimuat" error={refs.error} onRetry={() => refs.refetch()} />}
                {refs.isLoading && <Shimmer className="h-16" />}
                <div className="space-y-2">
                  {active.referenceIds.map((id) => {
                    const r = refs.data?.find((x) => x.id === id);
                    if (!r) return null;
                    return (
                      <a key={id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm transition-colors hover:bg-accent">
                        <span className="min-w-0"><b>{r.title}</b> <span className="text-muted-foreground">· {r.publisher}</span></span>
                        <span className="flex shrink-0 items-center gap-2"><VerificationBadge status={r.verificationStatus} /><ExternalLink className="h-3.5 w-3.5 text-primary" /></span>
                      </a>);
                  })}
                </div>
                <a href={`${import.meta.env.BASE_URL}referensi`} className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">Lihat periode, cakupan dan bukti peninjauan di pustaka</a>
              </div>)}
            <p className="mt-6 text-xs text-muted-foreground">Panduan ini membantu urutan kerja, bukan nasihat akuntansi atau perpajakan. Konfirmasikan perlakuan akhirnya dengan akuntan Anda.</p>
          </article>
        </div>}
    </>
  );
}
