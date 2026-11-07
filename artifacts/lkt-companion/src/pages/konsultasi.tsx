import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUp, Info, MessagesSquare, Trash2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import {
  getGetActivityQueryKey, getGetDashboardQueryKey, getGetMessagesQueryKey,
  getMessages, useAskConsultant, useClearMessages, useGetConsultationSpecialists, type ChatMessage, type ConsultationSpecialist,
} from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, Shimmer, errorMessage, fmtDate, useDocTitle } from "@/components/lkt/common";
import { ConsultationReferenceNote } from "@/components/lkt/consultation-reference-note";
import { FocusSelector, SpecialistBadge, specialistLabel } from "@/components/lkt/specialist-ui";


export default function KonsultasiPage() {
  useDocTitle("Konsultasi AI");
  const qc = useQueryClient();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const catalog = useGetConsultationSpecialists();
  const profiles = catalog.data ?? [];
  const fokusParam = new URLSearchParams(search).get("fokus");
  const requested = fokusParam ?? "umum";
  const matched = profiles.find((p) => p.id === requested);
  const invalidFocus = catalog.isSuccess && !matched && fokusParam !== null;
  const selectedProfile = matched ?? (catalog.isSuccess ? profiles.find((p) => p.id === "umum") : undefined);
  const selected: ConsultationSpecialist | undefined = selectedProfile?.id;
  const catalogReady = catalog.isSuccess && !!selectedProfile;
  const { toast } = useToast();
  const [searchText, setSearchText] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const historyKey = [...getGetMessagesQueryKey(), "infinite", historyQuery];
  const msgs = useInfiniteQuery({
    queryKey: historyKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getMessages({ before: pageParam, limit: 80, q: historyQuery || undefined }, { signal }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true,
  });
  // Pages arrive newest first, but each page's messages are chronological.
  // Keep the newest copy if a refresh and an older load overlap.
  const unique = new Map<string, ChatMessage>();
  for (const page of msgs.data?.pages ?? []) {
    for (const message of page.messages) if (!unique.has(message.id)) unique.set(message.id, message);
  }
  const messages = [...(msgs.data?.pages ?? [])].reverse()
    .flatMap(page => page.messages).filter(message => {
      if (unique.get(message.id) !== message) return false;
      unique.delete(message.id);
      return true;
    });
  const [text, setText] = useState("");
  const [replacement, setReplacement] = useState<string | null>(null);
  const [pending, setPending] = useState<{ content: string; specialist: ConsultationSpecialist } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prependRef = useRef<{ height: number; top: number; pages: number } | null>(null);
  const inval = () => { qc.invalidateQueries({ queryKey: getGetMessagesQueryKey() }); qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); qc.invalidateQueries({ queryKey: getGetActivityQueryKey() }); };
  const ask = useAskConsultant({ mutation: { onSuccess: () => { setText(""); inval(); }, onSettled: () => setPending(null) } });
  const reloadHistory = async () => {
    prependRef.current = null;
    await qc.cancelQueries({ queryKey: historyKey });
    await qc.resetQueries({ queryKey: historyKey });
  };
  const clear = useClearMessages({ mutation: { onSuccess: async () => { await reloadHistory(); inval(); ask.reset(); }, onError: (e) => toast({ variant: "destructive", title: "Riwayat gagal dihapus", description: errorMessage(e) }) } });

  useEffect(() => {
    if (!ask.isPending) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [ask.isPending]);
  const pageCount = msgs.data?.pages.length ?? 0;
  useLayoutEffect(() => {
    const anchor = prependRef.current;
    const container = scrollRef.current;
    if (anchor && container && pageCount > anchor.pages) {
      container.scrollTop = anchor.top + container.scrollHeight - anchor.height;
      prependRef.current = null;
    }
  }, [pageCount]);
  const latestId = messages.at(-1)?.id;
  useEffect(() => {
    if (!historyQuery) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestId, pending, historyQuery]);
  const searchHistory = (query: string) => {
    prependRef.current = null;
    setHistoryQuery(query.trim());
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const loadOlder = async () => {
    if (msgs.isFetching || !msgs.hasNextPage) return;
    const container = scrollRef.current;
    if (container) prependRef.current = { height: container.scrollHeight, top: container.scrollTop, pages: pageCount };
    const result = await msgs.fetchNextPage({ cancelRefetch: false });
    if (result.isError) prependRef.current = null;
  };

  const send = (content: string) => {
    const c = content.trim();
    if (!c || ask.isPending || clear.isPending || !catalogReady || !selected) return;
    const specialist = selected; // captured at send time
    setSearchText("");
    searchHistory("");
    setPending({ content: c, specialist });
    ask.mutate({ data: { content: c, specialist } });
  };
  const fillQuestion = (content: string) => {
    if (ask.isPending || clear.isPending) return;
    setText(content);
    setReplacement(null);
    ask.reset();
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast({ title: "Pertanyaan diisi ulang", description: "Belum dikirim. Periksa pertanyaan lalu tekan Kirim saat siap." });
  };
  const busy = ask.isPending || clear.isPending;
  const switchFocus = (id: ConsultationSpecialist) => {
    if (busy || id === selected) return;
    setLocation(`/konsultasi?fokus=${id}`, { replace: true });
  };
  const fillStarter = (content: string) => {
    if (busy) return;
    if (text.trim() && text !== content) { setReplacement(content); return; }
    setText(content); ask.reset(); inputRef.current?.focus();
  };
  const reuseQuestion = (content: string) => {
    if (ask.isPending || clear.isPending) return;
    if (text.trim() && text !== content) setReplacement(content);
    else fillQuestion(content);
  };

  return (
    <>
      <AlertDialog open={replacement !== null} onOpenChange={(open) => { if (!open) setReplacement(null); }}>
        <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti draf pertanyaan?</AlertDialogTitle>
            <AlertDialogDescription>Draf yang sedang Anda tulis akan diganti dengan pertanyaan dari jawaban ini. Pertanyaan tidak akan dikirim otomatis. Saat dikirim, pertanyaan memakai fokus yang sedang dipilih{selected ? ` (${specialistLabel(selected, profiles)})` : ""}, bukan fokus jawaban lama.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (replacement !== null) fillQuestion(replacement); }}>Ganti draf</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PageHeader eyebrow="Asisten" title="Konsultasi AI"
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button data-testid="button-clear-messages" disabled={!!historyQuery || !messages.length || clear.isPending || ask.isPending} className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-destructive hover:text-destructive disabled:opacity-40"><Trash2 className="h-4 w-4" /> Hapus riwayat</button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Hapus seluruh riwayat konsultasi?</AlertDialogTitle>
                <AlertDialogDescription>Semua pertanyaan dan jawaban perusahaan ini akan dihapus permanen untuk seluruh tim dan tidak bisa dikembalikan. Penghapusan ini tidak menarik kembali data yang telah dikirim ke penyedia AI.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction data-testid="button-confirm-clear" onClick={() => clear.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Ya, hapus</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }>
        Tanyakan langkah persiapan dalam bahasa sehari-hari.
      </PageHeader>

      <div className="rise mb-5 flex gap-3 rounded-xl border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/10 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(30_90%_35%)]" />
        <p><b>Jawaban dibuat oleh AI</b> dan bisa keliru. Asisten ini bukan pengganti akuntan, auditor, atau konsultan pajak, dan tidak memeriksa sumber web secara langsung. Jangan kirim data keuangan sensitif. Verifikasi kewajiban dan batas waktu ke naskah peraturan resmi.</p>
      </div>

      <section data-testid="panel-focus" className="rise mb-4 rounded-2xl border border-card-border bg-card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Fokus pendamping</p>
          <Link href="/pendamping" data-testid="link-catalog" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Lihat katalog dan batasnya</Link>
        </div>
        {catalog.isLoading ? (
          <div data-testid="state-focus-loading" className="mt-3 flex gap-2"><Shimmer className="h-8 w-20" /><Shimmer className="h-8 w-24" /><Shimmer className="h-8 w-24" /><Shimmer className="h-8 w-32" /></div>
        ) : catalog.isError ? (
          <div className="mt-3"><ErrorState title="Fokus pendamping belum bisa dimuat. Pengiriman ditahan." error={catalog.error} onRetry={() => catalog.refetch()} /></div>
        ) : !selectedProfile ? (
          <p role="alert" className="mt-3 text-sm text-destructive">Katalog pendamping tidak berisi fokus umum. Pengiriman ditahan sampai katalog tersedia.</p>
        ) : (
          <>
            {invalidFocus && <p role="alert" data-testid="state-invalid-focus" className="mt-3 flex gap-2 rounded-lg border border-[hsl(var(--signal))]/60 bg-[hsl(var(--signal))]/10 px-3 py-2 text-xs"><Info className="h-4 w-4 shrink-0" />Fokus "{fokusParam}" tidak dikenal. Konsultasi memakai fokus umum.</p>}
            <div className="mt-3"><FocusSelector profiles={profiles} value={selectedProfile.id} onChange={switchFocus} disabled={busy} /></div>
            <div key={selectedProfile.id} className="rise mt-3 grid gap-2 text-sm md:grid-cols-[1fr_1fr]">
              <p className="text-foreground/85">{selectedProfile.summary}</p>
              <p className="text-xs leading-relaxed text-muted-foreground"><b className="text-foreground">Batas:</b> {selectedProfile.boundary}</p>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Ganti fokus kapan saja dalam percakapan yang sama. Draf tidak hilang dan tidak dikirim otomatis. Jawaban lama tetap memakai fokus yang tercatat saat dibuat.</p>
          </>
        )}
      </section>

      <div className="flex min-h-[55vh] flex-col overflow-hidden rounded-2xl border border-card-border bg-card">
        <form role="search" onSubmit={(e) => { e.preventDefault(); searchHistory(searchText); }} className="space-y-2 border-b border-border p-4">
          <label htmlFor="history-search" className="text-sm font-semibold">Cari riwayat perusahaan</label>
          <div className="flex flex-wrap gap-2">
            <input id="history-search" data-testid="input-history-search" type="search" maxLength={200} value={searchText}
              onChange={(e) => setSearchText(e.target.value)} disabled={busy}
              placeholder="Kata dalam pertanyaan atau jawaban"
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <button data-testid="button-search-history" type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Cari</button>
            {(historyQuery || searchText) && <button data-testid="button-reset-history-search" type="button" disabled={busy}
              onClick={() => { setSearchText(""); searchHistory(""); }}
              className="rounded-lg border border-input px-3 py-2 text-sm font-semibold disabled:opacity-50">Tampilkan semua</button>}
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {historyQuery ? <>Hasil untuk “{historyQuery}”. Hanya pesan yang cocok ditampilkan; bukan percakapan lengkap. Tampilkan semua sebelum menghapus riwayat.</>
              : "Mencari di seluruh pesan perusahaan ini, termasuk riwayat yang belum dimuat. Pengiriman pertanyaan baru kembali ke seluruh riwayat."}
          </p>
        </form>
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6" style={{ maxHeight: "60vh", overflowAnchor: "none" }}>
          {msgs.isError && !msgs.data ? <ErrorState error={msgs.error} onRetry={() => reloadHistory()} />
            : msgs.isLoading ? [0, 1, 2].map((i) => <Shimmer key={i} className={cn("h-16", i % 2 ? "mr-auto w-3/4" : "ml-auto w-1/2")} />)
            : !messages.length && !pending ? (
              <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title={historyQuery ? "Tidak ada pesan yang cocok" : "Belum ada percakapan"}>
                {historyQuery ? "Coba kata lain atau pilih Tampilkan semua untuk kembali ke percakapan." : selectedProfile?.starters.length ? <>Pilih contoh untuk mengisi draf, lalu periksa sebelum mengirim:
                <div key={selectedProfile.id} className="mt-4 flex flex-col gap-2">{selectedProfile.starters.map((s, i) => <button key={s} data-testid={`button-starter-${i}`} disabled={busy} onClick={() => fillStarter(s)} className="rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition-all hover:-translate-y-0.5 hover:border-primary disabled:opacity-50">{s}</button>)}</div></> : "Tulis pertanyaan pertama Anda di bawah."}
              </EmptyState>)
            : <>
              <div className="space-y-2 text-center">
                {msgs.hasNextPage ? <button data-testid="button-load-older" disabled={msgs.isFetching || ask.isPending || clear.isPending} onClick={() => loadOlder()} className="rounded-lg border border-input px-4 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50">
                  {msgs.isFetchingNextPage ? "Memuat..." : historyQuery ? "Muat hasil lebih lama" : "Muat percakapan lebih lama"}
                </button> : <p data-testid="state-history-start" className="text-xs text-muted-foreground">{historyQuery ? "Semua hasil telah dimuat" : "Awal riwayat percakapan"}</p>}
                <p aria-live="polite" className="text-xs text-muted-foreground">{messages.length} {historyQuery ? "pesan cocok dimuat" : "pesan dimuat"}</p>
                {msgs.isError && <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>Riwayat belum berhasil dimuat. {errorMessage(msgs.error)}</p>
                  <button onClick={() => reloadHistory()} className="underline">Muat ulang riwayat dari pesan terbaru</button>
                </div>}
              </div>
              {messages.map((m) => (
                <div key={m.id} data-testid={`message-${m.id}`} className={cn("rise flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "rounded-br-sm bg-[hsl(var(--ink))] text-white" : "rounded-bl-sm border border-border bg-background")}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      {m.role === "assistant" && <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">LKTara AI</p>}
                      <SpecialistBadge id={m.specialist} profiles={profiles} tone={m.role === "user" ? "dark" : "light"} testId={`badge-focus-${m.id}`} />
                    </div>
                    <ConsultationReferenceNote message={m} onReuseQuestion={reuseQuestion} disabled={ask.isPending || clear.isPending} />
                    {m.role === "assistant" && m.referenceFreshness !== "current" && m.referenceFreshness !== "not_applicable" && m.originalQuestion && (
                      <p className="-mt-1 mb-3 text-[11px] text-muted-foreground">Bila diisi ulang lalu dikirim, pertanyaan memakai fokus yang sedang dipilih{selected ? `: ${specialistLabel(selected, profiles)}` : ""}, bukan fokus jawaban ini.</p>
                    )}
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                    <p className={cn("mt-1.5 font-mono text-[10px]", m.role === "user" ? "text-sky-200/70" : "text-muted-foreground")}>{fmtDate(m.createdAt)}</p>
                  </div>
                </div>))}
              {pending && (
                <>
                  <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[hsl(var(--ink))]/80 px-4 py-3 text-white"><div className="mb-1.5"><SpecialistBadge id={pending.specialist} profiles={profiles} tone="dark" /></div><p className="whitespace-pre-wrap text-[15px]">{pending.content}</p></div></div>
                  <div data-testid="state-thinking" className="rise max-w-[85%] rounded-2xl rounded-bl-sm border border-primary/40 bg-accent/30 px-4 py-3">
                    <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
                    <p className="mt-2 text-sm">Menyusun jawaban... <span className="font-mono text-xs text-muted-foreground">{elapsed} dtk</span></p>
                    <p className="text-xs text-muted-foreground">{elapsed > 15 ? "Jawaban panjang bisa memerlukan hingga satu menit. Tetap di halaman ini." : "Biasanya beberapa detik."}</p>
                  </div>
                </>)}
            </>}
          {ask.isError && !pending && (
            <ErrorState title="Pertanyaan belum terjawab" error={ask.error} onRetry={catalogReady ? () => send(text) : undefined} />
          )}
          {ask.isError && !pending && selected && (
            <p className="-mt-2 text-xs text-muted-foreground">Coba lagi mengirim draf dengan fokus yang sedang dipilih: {specialistLabel(selected, profiles)}.</p>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="border-t border-border bg-background/60 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
            <textarea ref={inputRef} data-testid="input-question" value={text} maxLength={4000} rows={2} disabled={ask.isPending || clear.isPending} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
              placeholder="Tulis pertanyaan Anda. Enter untuk kirim, Shift+Enter untuk baris baru." className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" />
            <button data-testid="button-send" type="submit" disabled={!text.trim() || ask.isPending || clear.isPending || !catalogReady} aria-label="Kirim" className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
            <span data-testid="text-send-focus">{catalogReady && selected ? <>Dikirim dengan fokus <b className="text-foreground">{specialistLabel(selected, profiles)}</b></> : catalog.isLoading ? "Memuat fokus..." : "Pengiriman ditahan: fokus belum tersedia"}</span>
            <span>{text.length}/4000</span>
          </div>
        </form>
      </div>
    </>
  );
}
