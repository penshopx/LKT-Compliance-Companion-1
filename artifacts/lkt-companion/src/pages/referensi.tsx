import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, ExternalLink, Library, Search } from "lucide-react";
import { getGetDashboardQueryKey, getGetReferencesQueryKey, getGetActivityQueryKey, useBookmarkReference, useGetReferences, type Reference } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, Shimmer, UnverifiedBadge, errorMessage, useDocTitle } from "@/components/lkt/common";

export default function ReferensiPage() {
  useDocTitle("Referensi");
  const refs = useGetReferences();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("semua");
  const [saved, setSaved] = useState(false);
  const cats = useMemo(() => [...new Set((refs.data ?? []).map((r) => r.category))], [refs.data]);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (refs.data ?? []).filter((r) => (cat === "semua" || r.category === cat) && (!saved || r.bookmarked) && (!s || `${r.title} ${r.publisher} ${r.summary} ${r.scope}`.toLowerCase().includes(s)));
  }, [refs.data, q, cat, saved]);
  const savedCount = refs.data?.filter((r) => r.bookmarked).length ?? 0;

  return (
    <>
      <PageHeader eyebrow="Pustaka" title="Referensi">
        Tautan sumber resmi dan artikel pendukung. Ringkasan adalah deskripsi topik dari tim editorial, bukan kutipan isi artikel. Semua sumber <b className="text-foreground">belum diverifikasi</b> keberlakuannya; artikel edukasi bukan pengganti naskah peraturan resmi.
      </PageHeader>
      <div className="rise mb-4 rounded-xl border border-primary/30 bg-accent/40 p-4 text-sm">
        <b>Laporan tahunan</b> (annual report) memuat profil, tata kelola, dan kinerja perusahaan secara luas. <b>Laporan keuangan</b> (financial report) adalah bagian intinya: posisi keuangan, laba rugi, arus kas, dan catatan. Cakupan keduanya berbeda.
      </div>
      <div className="rise mb-6 flex flex-col gap-3 lg:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input data-testid="input-search-references" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul, penerbit, atau topik" className="h-10 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {["semua", ...cats].map((c) => <button key={c} onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors", cat === c ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white" : "border-input bg-card hover:border-primary")}>{c === "semua" ? "Semua kategori" : c}</button>)}
          <button data-testid="filter-saved" onClick={() => setSaved(!saved)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", saved ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:border-primary")}><BookmarkCheck className="h-3.5 w-3.5" /> Tersimpan ({savedCount})</button>
        </div>
      </div>
      {refs.isError ? <ErrorState error={refs.error} onRetry={() => refs.refetch()} />
        : refs.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-40" />)}</div>
        : !list.length ? <EmptyState icon={<Library className="h-5 w-5" />} title={saved ? "Belum ada referensi tersimpan" : "Tidak ada referensi cocok"}>{saved ? "Tandai referensi dengan ikon penanda untuk mengumpulkannya di sini." : "Ubah kata kunci atau kategori."}</EmptyState>
        : <div className="grid gap-3 md:grid-cols-2">{list.map((r, i) => <Card key={r.id} r={r} i={i} />)}</div>}
    </>
  );
}

function Card({ r, i }: { r: Reference; i: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const bm = useBookmarkReference({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetReferencesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetActivityQueryKey() }); },
      onError: (e) => toast({ variant: "destructive", title: "Penanda gagal disimpan", description: errorMessage(e) }),
    },
  });
  return (
    <article data-testid={`card-reference-${r.id}`} style={{ animationDelay: `${i * 40}ms` }} className="rise flex flex-col rounded-xl border border-card-border bg-card p-5 transition-all hover:border-primary">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md bg-[hsl(var(--ink))] px-2 py-0.5 text-[11px] font-semibold text-white">{r.category}</span>
          <UnverifiedBadge />
        </div>
        <button data-testid={`button-bookmark-${r.id}`} disabled={bm.isPending} onClick={() => bm.mutate({ id: r.id, data: { bookmarked: !r.bookmarked } })} aria-label="Simpan referensi"
          className={cn("rounded-lg p-1.5 transition-all active:scale-90", r.bookmarked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-primary", bm.isPending && "opacity-50")}>
          {r.bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>
      <h3 className="font-display mt-3 text-lg font-bold leading-snug">{r.title}</h3>
      <p className="text-xs font-semibold text-primary">{r.publisher}</p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.summary}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Berlaku untuk: <b className="text-foreground">{r.scope}</b></span>
        <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline">Buka sumber <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
    </article>
  );
}
