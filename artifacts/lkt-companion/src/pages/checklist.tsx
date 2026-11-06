import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ClipboardList, Download, Loader2, Search } from "lucide-react";
import {
  getGetActivityQueryKey, getGetChecklistQueryKey, getGetDashboardQueryKey,
  useGetChecklist, useGetCompany, useUpdateChecklist, type ChecklistItem, type ChecklistUpdateStatus,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, PageHeader, STATUS_LABEL, Shimmer, StatusPill, errorMessage, useDocTitle } from "@/components/lkt/common";

const STATUSES: ChecklistUpdateStatus[] = ["belum", "proses", "selesai"];

export default function ChecklistPage() {
  useDocTitle("Daftar persiapan");
  const list = useGetChecklist();
  const company = useGetCompany();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("semua");

  const items = useMemo(() => {
    const s = q.toLowerCase();
    return (list.data ?? []).filter((i) => (filter === "semua" || i.status === filter) && (!s || `${i.title} ${i.description} ${i.category} ${i.notes}`.toLowerCase().includes(s)));
  }, [list.data, q, filter]);

  const groups = useMemo(() => {
    const m = new Map<string, ChecklistItem[]>();
    items.forEach((i) => m.set(i.category, [...(m.get(i.category) ?? []), i]));
    return [...m.entries()];
  }, [items]);

  const exportCsv = () => {
    const rows = [["Kategori", "Langkah", "Deskripsi", "Status", "Catatan", "Cakupan"], ...(list.data ?? []).map((i) => [i.category, i.title, i.description, STATUS_LABEL[i.status], i.notes, i.scope])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `daftar-persiapan-lkt-${company.data?.year ?? ""}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader eyebrow={`Tahun buku ${company.data?.year ?? ""}`} title="Daftar persiapan"
        actions={<button data-testid="button-export-csv" disabled={!list.data?.length} onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold transition-all hover:border-primary hover:text-primary disabled:opacity-40"><Download className="h-4 w-4" /> Unduh CSV</button>}>
        Langkah disesuaikan dengan jenis perusahaan di profil. Ubah status dan tulis catatan untuk diri sendiri atau akuntan Anda.
      </PageHeader>

      <div className="rise mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input data-testid="input-search-checklist" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari langkah atau catatan" className="h-10 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <div className="flex rounded-lg border border-input bg-card p-1">
          {["semua", ...STATUSES].map((s) => (
            <button key={s} data-testid={`filter-${s}`} onClick={() => setFilter(s)} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", filter === s ? "bg-[hsl(var(--ink))] text-white" : "text-muted-foreground hover:text-foreground")}>
              {s === "semua" ? "Semua" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {list.isError ? <ErrorState error={list.error} onRetry={() => list.refetch()} />
        : list.isLoading ? <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-16" />)}</div>
        : !list.data?.length ? <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Belum ada langkah">Daftar untuk profil ini kosong. Periksa jenis perusahaan di Profil Perusahaan.</EmptyState>
        : !items.length ? <EmptyState icon={<Search className="h-5 w-5" />} title="Tidak ada yang cocok" action={<button onClick={() => { setQ(""); setFilter("semua"); }} className="text-sm font-semibold text-primary">Reset filter</button>}>Coba kata kunci lain.</EmptyState>
        : <div className="space-y-8">{groups.map(([cat, its]) => (
          <section key={cat}>
            <h2 className="mb-2 flex items-center gap-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{cat}<span className="h-px flex-1 bg-border" /><span>{its.filter((i) => i.status === "selesai").length}/{its.length}</span></h2>
            <div className="space-y-2">{its.map((i) => <Row key={i.id} item={i} />)}</div>
          </section>))}</div>}
    </>
  );
}

function Row({ item }: { item: ChecklistItem }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes);
  const qc = useQueryClient();
  const { toast } = useToast();
  const upd = useUpdateChecklist({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetChecklistQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
      },
      onError: (e) => toast({ variant: "destructive", title: "Gagal menyimpan", description: errorMessage(e) }),
    },
  });
  const save = (status: ChecklistUpdateStatus, n = item.notes) => upd.mutate({ id: item.id, data: { status, notes: n } });
  const dirty = notes !== item.notes;

  return (
    <div data-testid={`row-checklist-${item.id}`} className={cn("rounded-xl border bg-card transition-all", open ? "border-primary shadow-[0_10px_30px_-18px_hsl(var(--primary))]" : "border-card-border hover:border-input")}>
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <button onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-start gap-3 text-left" data-testid={`button-toggle-${item.id}`}>
          <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-primary")} />
          <div className="min-w-0">
            <p className={cn("font-semibold", item.status === "selesai" && "text-muted-foreground line-through decoration-[hsl(var(--ok))]")}>{item.title}</p>
            {!open && item.notes && <p className="truncate text-xs text-muted-foreground">Catatan: {item.notes}</p>}
          </div>
        </button>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          {STATUSES.map((s) => (
            <button key={s} data-testid={`button-status-${s}-${item.id}`} disabled={upd.isPending} onClick={() => s !== item.status && save(s)}
              className={cn("rounded-md px-2.5 py-1 text-[11px] font-bold transition-all", item.status === s
                ? s === "selesai" ? "bg-[hsl(var(--ok))] text-white" : s === "proses" ? "bg-[hsl(var(--signal))] text-[hsl(var(--ink))]" : "bg-[hsl(var(--ink))] text-white"
                : "text-muted-foreground hover:bg-card hover:text-foreground")}>
              {STATUS_LABEL[s]}
            </button>
          ))}
          {upd.isPending && <Loader2 className="mx-1 h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
      </div>
      {open && (
        <div className="rise border-t border-border px-4 pb-4 pt-3 md:pl-11">
          <p className="text-sm leading-relaxed text-foreground/85">{item.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">Cakupan: <span className="font-semibold text-foreground">{item.scope}</span> · Status saat ini: <StatusPill status={item.status} /></p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catatan kerja</label>
          <textarea data-testid={`input-notes-${item.id}`} value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Misalnya: siapa yang memegang dokumen, apa yang masih ditunggu. Hindari angka keuangan sensitif."
            className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <div className="mt-2 flex items-center justify-end gap-2">
            {dirty && <button onClick={() => setNotes(item.notes)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Batal</button>}
            <button data-testid={`button-save-notes-${item.id}`} disabled={!dirty || upd.isPending} onClick={() => save(item.status, notes)}
              className="rounded-lg bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
              {upd.isPending ? "Menyimpan..." : "Simpan catatan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
