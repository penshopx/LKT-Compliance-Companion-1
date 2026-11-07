import { useState } from "react";
import { useGetLktAccessAudit, type GetLktAccessAuditParams } from "@workspace/api-client-react";
import { AuditEntries } from "./access-audit";
import { ErrorState, Shimmer } from "./common";

type Filters = Pick<GetLktAccessAuditParams, "action" | "startDate" | "endDate">;
const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
const buttonClass = "rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function AccessAuditBrowser() {
  const [draft, setDraft] = useState<Filters>({});
  const [filters, setFilters] = useState<Filters>({});
  const [cursors, setCursors] = useState<string[]>([]);
  const audit = useGetLktAccessAudit(
    { ...filters, limit: 50, cursor: cursors.at(-1) },
    { query: { refetchInterval: 60_000, refetchOnMount: "always" } },
  );
  const invalidRange = !!(draft.startDate && draft.endDate && draft.startDate > draft.endDate);
  const reset = () => { setDraft({}); setFilters({}); setCursors([]); };

  return (
    <div className="space-y-4">
      <form className="space-y-3" onSubmit={event => {
        event.preventDefault();
        if (!invalidRange) { setFilters({ ...draft }); setCursors([]); }
      }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">Tindakan
            <select aria-label="Filter tindakan audit" data-testid="select-audit-action" className={inputClass}
              value={draft.action ?? ""} onChange={event => setDraft({ ...draft, action: (event.target.value || undefined) as Filters["action"] })}>
              <option value="">Semua tindakan</option>
              <option value="member_added">Anggota ditambahkan</option>
              <option value="member_removed">Akses dicabut</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">Dari tanggal (WIB)
            <input aria-label="Tanggal awal audit" data-testid="input-audit-start" type="date" className={inputClass}
              value={draft.startDate ?? ""} onChange={event => setDraft({ ...draft, startDate: event.target.value || undefined })} />
          </label>
          <label className="space-y-1 text-sm">Sampai tanggal (WIB)
            <input aria-label="Tanggal akhir audit" data-testid="input-audit-end" type="date" className={inputClass}
              value={draft.endDate ?? ""} onChange={event => setDraft({ ...draft, endDate: event.target.value || undefined })} />
          </label>
        </div>
        {invalidRange && <p role="alert" className="text-sm text-destructive">Tanggal akhir tidak boleh sebelum tanggal awal.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" data-testid="button-apply-audit-filter" className={buttonClass} disabled={invalidRange}>Terapkan filter</button>
          <button type="button" className={buttonClass} onClick={reset}>Hapus filter</button>
          <button type="button" className={buttonClass} onClick={() => {
            setCursors([]);
            if (!cursors.length) void audit.refetch();
          }}>Catatan terbaru</button>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">Hasil memakai filter yang diterapkan. Kedua tanggal termasuk dalam pencarian. Maksimal 50 catatan per halaman, terbaru lebih dahulu.</p>
      <div aria-live="polite" aria-busy={audit.isFetching}>
        {audit.isLoading ? <Shimmer className="h-24" /> : audit.isError ? (
          <ErrorState title="Jejak audit belum bisa dimuat" error={audit.error} onRetry={() => audit.refetch()} />
        ) : <AuditEntries entries={audit.data?.entries ?? []} emptyText="Tidak ada catatan yang cocok dalam retensi 90 hari." />}
      </div>
      <nav aria-label="Halaman jejak audit" className="flex flex-wrap items-center gap-2">
        <button type="button" data-testid="button-audit-previous" className={buttonClass}
          disabled={!cursors.length || audit.isFetching} onClick={() => setCursors(previous => previous.slice(0, -1))}>Lebih baru</button>
        <span className="text-sm">Halaman {cursors.length + 1}</span>
        <button type="button" data-testid="button-audit-next" className={buttonClass}
          disabled={!audit.data?.nextCursor || audit.isFetching || audit.isError}
          onClick={() => { if (audit.data?.nextCursor) setCursors(previous => [...previous, audit.data.nextCursor!]); }}>Lebih lama</button>
      </nav>
    </div>
  );
}
