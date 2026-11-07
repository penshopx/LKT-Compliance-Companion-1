import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Bookmark, BookmarkCheck, ExternalLink, Library, Search } from "lucide-react";
import { getGetDashboardQueryKey, getGetReferencesQueryKey, getGetActivityQueryKey, useBookmarkReference, useGetReferences, type Reference } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, KIND_LABEL, PageHeader, Shimmer, VerificationBadge, VERIFICATION_LABEL, errorMessage, useDocTitle } from "@/components/lkt/common";
import { ReferenceDigestPanel } from "@/components/lkt/reference-digest";
import { EvidenceArchives } from "@/components/lkt/evidence-archives";

export default function ReferensiPage() {
  useDocTitle("Referensi");
  // Refresh across team sessions and day boundaries, not only after bookmarks.
  const refs = useGetReferences({ query: { staleTime: 60_000, refetchInterval: 60_000 } });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("semua");
  const [saved, setSaved] = useState(false);
  const [scope, setScope] = useState("semua");
  const [verification, setVerification] = useState("semua");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const cats = useMemo(() => [...new Set((refs.data ?? []).map((r) => r.category))], [refs.data]);
  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (refs.data ?? []).filter((r) =>
      (cat === "semua" || r.category === cat) && (!saved || r.bookmarked) &&
      (scope === "semua" || r.scope === scope) &&
      (verification === "semua" || r.verificationStatus === verification) &&
      (!overdueOnly || r.reviewOverdue) &&
      (!s || `${r.title} ${r.publisher} ${r.summary} ${r.scope} ${r.editorialOwner} ${r.applicability} ${r.effectivePeriod} ${r.standards.join(" ")} ${r.verificationNotes} ${r.primarySources.map(p => `${p.title} ${p.locator} ${p.finding}`).join(" ")}`.toLowerCase().includes(s)));
  }, [refs.data, q, cat, saved, scope, verification, overdueOnly]);
  const savedCount = refs.data?.filter((r) => r.bookmarked).length ?? 0;
  const overdueCount = refs.data?.filter((r) => r.reviewOverdue).length ?? 0;

  return (
    <>
      <PageHeader eyebrow="Pustaka" title="Referensi">
        Hasil peninjauan 11 tautan awal dan sumber resmi pelengkap, serta PDF akademik dan referensi komersial tambahan. Status <b className="text-foreground">primer terverifikasi</b> hanya mencakup temuan yang disebutkan, bukan jaminan kepatuhan atau pemeriksaan seluruh perubahan. Artikel pendukung dan PDF akademik 2007 bukan pengganti regulasi terkini; ringkasan PDF merujuk abstraknya. Referensi komersial bukan rekomendasi pembelian atau bukti kebenaran klaim hukum penyedia.
      </PageHeader>
      <div className="rise mb-4 rounded-xl border border-primary/30 bg-accent/40 p-4 text-sm">
        <b>Laporan tahunan</b> (annual report) mencakup pertanggungjawaban, profil, tata kelola dan kinerja secara luas. <b>Laporan keuangan</b> (financial report) menyajikan informasi keuangan sesuai standar; komponennya bergantung pada standar yang berlaku. <b>SPT Tahunan</b> adalah pelaporan pajak yang berbeda.
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Nonpublik, UMKM, publik dan KJPP memiliki cakupan berbeda dan dapat beririsan. Filter berikut menunjukkan topik sumber, bukan penetapan seluruh kewajiban profil Anda. Lihat tanggal peninjauan masing-masing sumber dan cocokkan kembali dengan periode tujuan.</p>
      {overdueCount > 0 && <div role="status" data-testid="reference-review-reminder" className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 shrink-0" />{overdueCount} referensi lewat jadwal tinjau ulang</p>
        <p className="mt-1">Penanggung jawab editorial perlu memeriksa perubahan sumber dan mencatat temuannya. Status verifikasi terakhir tetap ditampilkan sebagai riwayat, bukan jaminan bahwa temuan masih berlaku.</p>
      </div>}
      <div className="mb-4 rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Jadwal ini adalah pengingat editorial berdasarkan hari kalender WIB, bukan tenggat hukum. Tautan yang dapat dibuka tidak otomatis memperbarui tanggal atau menaikkan status verifikasi. Penanggung jawab di bawah adalah peran redaksi; perubahan dicatat melalui pembaruan editorial pustaka.
      </div>
      <Link href="/redaksi" data-testid="link-redaksi" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card px-4 py-3 text-sm transition-colors hover:border-primary">
        <span><b>Ruang kerja redaksi</b> <span className="text-muted-foreground">· catat jadwal tinjau ulang dan temuan bersama lintas perusahaan</span></span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>
      <ReferenceDigestPanel />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" data-testid="filter-reference-overdue" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
          Lewat jadwal ({overdueCount})
        </label>
        <label className="text-xs font-semibold">Cakupan topik
          <select data-testid="filter-reference-scope" value={scope} onChange={e => setScope(e.target.value)} className="ml-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
            <option value="semua">Semua cakupan</option><option value="umum">Umum</option>
            {Object.entries(KIND_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Hasil verifikasi
          <select data-testid="filter-reference-verification" value={verification} onChange={e => setVerification(e.target.value)} className="ml-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
            <option value="semua">Semua status</option>
            {Object.entries(VERIFICATION_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
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
          <VerificationBadge status={r.verificationStatus} />
        </div>
        <button data-testid={`button-bookmark-${r.id}`} disabled={bm.isPending} onClick={() => bm.mutate({ id: r.id, data: { bookmarked: !r.bookmarked } })} aria-label="Simpan referensi"
          className={cn("rounded-lg p-1.5 transition-all active:scale-90", r.bookmarked ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-primary", bm.isPending && "opacity-50")}>
          {r.bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      </div>
      <h3 className="font-display mt-3 text-lg font-bold leading-snug">{r.title}</h3>
      <p className="text-xs font-semibold text-primary">{r.publisher}</p>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.summary}</p>
      <dl className="mt-3 space-y-2 text-xs leading-relaxed">
        <div><dt className="font-semibold">Ditinjau</dt><dd><time dateTime={r.reviewedAt}>{r.reviewedAt}</time> · {r.sourceType === "primary" ? "Sumber primer" : "Sumber pendukung"} · {{ annual_report: "Annual report", financial_report: "Financial report", tax_return: "SPT Tahunan", mixed: "Beberapa jenis laporan" }[r.reportType]}</dd></div>
        <div><dt className="font-semibold">Penanggung jawab editorial</dt><dd className="text-muted-foreground">{r.editorialOwner}</dd></div>
        <div><dt className="font-semibold">Tinjau ulang berikutnya</dt><dd><time dateTime={r.nextReviewAt}>{r.nextReviewAt}</time> (WIB)
          {r.reviewOverdue && <span data-testid={`review-overdue-${r.id}`} className="ml-2 inline-block rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-semibold">Lewat jadwal — perlu ditinjau ulang</span>}
        </dd></div>
        <div><dt className="font-semibold">Cakupan penerapan</dt><dd className="text-muted-foreground">{r.applicability}</dd></div>
        <div><dt className="font-semibold">Periode dan standar</dt><dd className="text-muted-foreground">{r.effectivePeriod}<br />Standar: {r.standards.length ? r.standards.join("; ") : "Tidak ditetapkan oleh sumber ini."}</dd></div>
      </dl>
      <details className="mt-3 rounded-lg border border-border p-3 text-xs leading-relaxed">
        <summary className="cursor-pointer font-semibold text-primary">Temuan dan batas verifikasi</summary>
        <p className="mt-2 text-muted-foreground">{r.verificationNotes}</p>
        {r.primarySources.length ? <ul className="mt-3 space-y-3">{r.primarySources.map(p => <li key={p.url}>
          <a className="font-semibold text-primary hover:underline" href={p.url} target="_blank" rel="noreferrer">{p.title} <ExternalLink className="inline h-3 w-3" /></a>
          <p className="font-semibold">{p.locator}</p><p className="text-muted-foreground">{p.finding}</p>
        </li>)}</ul> : <p className="mt-2 text-muted-foreground">Tidak ada sumber primer yang ditetapkan untuk klaim hukum artikel ini.</p>}
      </details>
      <details className="mt-3 rounded-lg border border-border p-3 text-xs leading-relaxed">
        <summary className="cursor-pointer font-semibold text-primary">Riwayat temuan ({r.reviewHistory.length})</summary>
        <ol className="mt-2 space-y-4">{[...r.reviewHistory].reverse().map((event, index) => <li key={`${event.recordedAt}-${index}`} className="border-l-2 border-border pl-3">
          <p className="font-semibold"><time dateTime={event.recordedAt}>{event.recordedAt}</time> · {event.editorialOwner}
            {event.kind && <span className="ml-2 rounded border border-border px-1.5 py-0.5 font-normal">{event.kind === "schedule" ? "Jadwal saja" : "Temuan"}</span>}</p>
          {event.actorName && <p className="text-muted-foreground">Dicatat oleh {event.actorName}</p>}
          <p className="mt-1">{event.changeSummary}</p>
          <p className="mt-1">Status: {VERIFICATION_LABEL[event.verificationStatus]} · Jadwal berikutnya: {event.nextReviewAt}</p>
          <p className="mt-1 text-muted-foreground">{event.verificationNotes}</p>
          <p className="mt-1 text-muted-foreground">Cakupan: {event.applicability}</p>
          <p className="mt-1 text-muted-foreground">Periode: {event.effectivePeriod}</p>
          <p className="mt-1 text-muted-foreground">Standar: {event.standards.join("; ") || "Tidak ditetapkan oleh sumber ini."}</p>
          {event.primarySources.map((source) => <div key={source.url} className="mt-2 text-muted-foreground">
            <a className="font-semibold text-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">{source.title} <ExternalLink className="inline h-3 w-3" /></a>
            <p>{source.locator}</p><p>{source.finding}</p>
          </div>)}
          <EvidenceArchives event={event} />
        </li>)}</ol>
      </details>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <span className="text-muted-foreground">Topik: <b className="text-foreground">{KIND_LABEL[r.scope] ?? r.scope}</b></span>
        <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline">Buka sumber <ExternalLink className="h-3.5 w-3.5" /></a>
      </div>
    </article>
  );
}
