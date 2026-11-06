import type { AccessAuditEntry } from "@workspace/api-client-react";

const labels = {
  member_added: "Anggota ditambahkan",
  member_removed: "Akses anggota dicabut",
  organization_deleted: "Perusahaan dihapus",
};

export function AuditEntries({ entries }: { entries: AccessAuditEntry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">Belum ada catatan dalam 90 hari terakhir.</p>;
  return (
    <ol className="max-h-96 space-y-3 overflow-y-auto" data-testid="list-access-audit">
      {entries.map(entry => (
        <li key={entry.id} className="rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold">{labels[entry.action]}</p>
          <p className="mt-1 break-all">Pelaku: <code>{entry.actorUserId}</code></p>
          {entry.targetUserId && <p className="break-all">Anggota: <code>{entry.targetUserId}</code></p>}
          <p className="mt-1 text-xs text-muted-foreground">
            <time dateTime={String(entry.createdAt)}>{new Date(entry.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</time>
          </p>
        </li>
      ))}
    </ol>
  );
}

export function DeletionReceipts({ entries }: { entries: AccessAuditEntry[] }) {
  if (!entries.length) return null;
  return (
    <section className="mt-6 rounded-2xl border border-card-border bg-card p-5" data-testid="section-deletion-receipts">
      <h2 className="font-display text-xl font-bold">Tanda terima penghapusan Anda</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Maksimal 100 catatan terbaru, hanya untuk akun pemilik yang menghapus. Disimpan 90 hari tanpa nama, ID, atau isi data perusahaan.</p>
      <AuditEntries entries={entries} />
    </section>
  );
}
