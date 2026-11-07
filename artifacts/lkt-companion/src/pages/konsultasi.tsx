import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUp, MessagesSquare, Trash2 } from "lucide-react";
import {
  getGetActivityQueryKey, getGetDashboardQueryKey, getGetMessagesQueryKey,
  getMessages, useAskConsultant, useClearMessages, type ChatMessage,
} from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, Shimmer, errorMessage, fmtDate, useDocTitle } from "@/components/lkt/common";
import { ConsultationReferenceNote } from "@/components/lkt/consultation-reference-note";

const STARTERS = [
  "Apa beda laporan tahunan dan laporan keuangan untuk perusahaan saya?",
  "Dokumen apa yang sebaiknya saya kumpulkan sebelum bertemu akuntan?",
  "Bagaimana mulai merapikan bukti transaksi yang tercecer?",
];

export default function KonsultasiPage() {
  useDocTitle("Konsultasi AI");
  const qc = useQueryClient();
  const { toast } = useToast();
  const historyKey = [...getGetMessagesQueryKey(), "infinite"];
  const msgs = useInfiniteQuery({
    queryKey: historyKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => getMessages({ before: pageParam, limit: 80 }, { signal }),
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
  const [pending, setPending] = useState<string | null>(null);
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
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [latestId, pending]);
  const loadOlder = async () => {
    if (msgs.isFetching || !msgs.hasNextPage) return;
    const container = scrollRef.current;
    if (container) prependRef.current = { height: container.scrollHeight, top: container.scrollTop, pages: pageCount };
    const result = await msgs.fetchNextPage({ cancelRefetch: false });
    if (result.isError) prependRef.current = null;
  };

  const send = (content: string) => {
    const c = content.trim();
    if (!c || ask.isPending || clear.isPending) return;
    setPending(c);
    ask.mutate({ data: { content: c } });
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
            <AlertDialogDescription>Draf yang sedang Anda tulis akan diganti dengan pertanyaan dari jawaban ini. Pertanyaan tidak akan dikirim otomatis.</AlertDialogDescription>
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
              <button data-testid="button-clear-messages" disabled={!messages.length || clear.isPending || ask.isPending} className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold transition-colors hover:border-destructive hover:text-destructive disabled:opacity-40"><Trash2 className="h-4 w-4" /> Hapus riwayat</button>
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

      <div className="flex min-h-[55vh] flex-col overflow-hidden rounded-2xl border border-card-border bg-card">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6" style={{ maxHeight: "60vh", overflowAnchor: "none" }}>
          {msgs.isError && !msgs.data ? <ErrorState error={msgs.error} onRetry={() => reloadHistory()} />
            : msgs.isLoading ? [0, 1, 2].map((i) => <Shimmer key={i} className={cn("h-16", i % 2 ? "mr-auto w-3/4" : "ml-auto w-1/2")} />)
            : !messages.length && !pending ? (
              <EmptyState icon={<MessagesSquare className="h-5 w-5" />} title="Belum ada percakapan">
                Mulai dengan salah satu pertanyaan ini:
                <div className="mt-4 flex flex-col gap-2">{STARTERS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-lg border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition-all hover:-translate-y-0.5 hover:border-primary">{s}</button>)}</div>
              </EmptyState>)
            : <>
              <div className="space-y-2 text-center">
                {msgs.hasNextPage ? <button data-testid="button-load-older" disabled={msgs.isFetching || ask.isPending || clear.isPending} onClick={() => loadOlder()} className="rounded-lg border border-input px-4 py-2 text-sm font-semibold hover:border-primary disabled:opacity-50">
                  {msgs.isFetchingNextPage ? "Memuat percakapan..." : "Muat percakapan lebih lama"}
                </button> : <p data-testid="state-history-start" className="text-xs text-muted-foreground">Awal riwayat percakapan</p>}
                <p aria-live="polite" className="text-xs text-muted-foreground">{messages.length} pesan dimuat</p>
                {msgs.isError && <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>Riwayat belum berhasil dimuat. {errorMessage(msgs.error)}</p>
                  <button onClick={() => reloadHistory()} className="underline">Muat ulang riwayat dari pesan terbaru</button>
                </div>}
              </div>
              {messages.map((m) => (
                <div key={m.id} data-testid={`message-${m.id}`} className={cn("rise flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-3", m.role === "user" ? "rounded-br-sm bg-[hsl(var(--ink))] text-white" : "rounded-bl-sm border border-border bg-background")}>
                    {m.role === "assistant" && <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">LKTara AI</p>}
                    <ConsultationReferenceNote message={m} onReuseQuestion={reuseQuestion} disabled={ask.isPending || clear.isPending} />
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</p>
                    <p className={cn("mt-1.5 font-mono text-[10px]", m.role === "user" ? "text-sky-200/70" : "text-muted-foreground")}>{fmtDate(m.createdAt)}</p>
                  </div>
                </div>))}
              {pending && (
                <>
                  <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[hsl(var(--ink))]/80 px-4 py-3 text-white"><p className="whitespace-pre-wrap text-[15px]">{pending}</p></div></div>
                  <div data-testid="state-thinking" className="rise max-w-[85%] rounded-2xl rounded-bl-sm border border-primary/40 bg-accent/30 px-4 py-3">
                    <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />)}</div>
                    <p className="mt-2 text-sm">Menyusun jawaban... <span className="font-mono text-xs text-muted-foreground">{elapsed} dtk</span></p>
                    <p className="text-xs text-muted-foreground">{elapsed > 15 ? "Jawaban panjang bisa memerlukan hingga satu menit. Tetap di halaman ini." : "Biasanya beberapa detik."}</p>
                  </div>
                </>)}
            </>}
          {ask.isError && !pending && (
            <ErrorState title="Pertanyaan belum terjawab" error={ask.error} onRetry={() => send(text)} />
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="border-t border-border bg-background/60 p-3">
          <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 focus-within:ring-2 focus-within:ring-ring">
            <textarea ref={inputRef} data-testid="input-question" value={text} maxLength={4000} rows={2} disabled={ask.isPending || clear.isPending} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
              placeholder="Tulis pertanyaan Anda. Enter untuk kirim, Shift+Enter untuk baris baru." className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none" />
            <button data-testid="button-send" type="submit" disabled={!text.trim() || ask.isPending || clear.isPending} aria-label="Kirim" className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"><ArrowUp className="h-5 w-5" /></button>
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{text.length}/4000</p>
        </form>
      </div>
    </>
  );
}
