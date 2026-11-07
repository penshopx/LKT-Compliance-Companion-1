import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAccessNotifications, useSaveAccessNotifications, useStopAccessNotifications,
  getGetAccessNotificationsQueryKey, type AccessNotificationDelivery,
} from "@workspace/api-client-react";
import { ErrorState, errorMessage, Shimmer } from "./common";

const labels: Record<AccessNotificationDelivery["status"], string> = {
  pending: "Menunggu pengiriman", sending: "Sedang dikirim", delivered: "Diterima Slack",
  failed: "Gagal — tidak diulang otomatis", uncertain: "Belum pasti — periksa Slack, tidak diulang",
  cancelled: "Dibatalkan",
};

export function AccessNotifications() {
  const query = useGetAccessNotifications({ query: { staleTime: 0, refetchInterval: 15_000 } });
  const save = useSaveAccessNotifications();
  const stop = useStopAccessNotifications();
  const qc = useQueryClient();
  const [recipient, setRecipient] = useState<string | null>(null);
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = save.isPending || stop.isPending;
  if (query.isLoading) return <Shimmer className="h-32" />;
  if (query.isError) return <ErrorState title="Pengaturan notifikasi belum bisa dimuat" error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  const data = query.data;
  const destination = recipient ?? data.recipient;
  const stale = editRevision !== null && editRevision !== data.revision;
  const valid = /^[CGUW][A-Z0-9]{8,30}$/.test(destination.trim());
  return (
    <div className="space-y-4 text-sm" data-testid="access-notification-settings">
      <p>Slack: <strong>{data.enabled ? "Aktif" : "Nonaktif"}</strong>{data.recipientLabel && ` · ${data.recipientLabel}`}</p>
      <p className="text-muted-foreground">Khusus pemberian dan pencabutan akses anggota setelah pengaturan aktif. Terpisah dari ringkasan referensi terjadwal. Tidak mengirim riwayat lama.</p>
      <form className="space-y-3" onSubmit={async e => {
        e.preventDefault();
        if (!valid || !consent || pending || stale) return;
        setNotice("");
        try {
          const result = await save.mutateAsync({ data: { recipient: destination.trim(), consent: true, expectedRevision: editRevision ?? data.revision } });
          qc.setQueryData(getGetAccessNotificationsQueryKey(), result);
          setRecipient(null); setEditRevision(null); setConsent(false);
          setNotice("Notifikasi diaktifkan untuk perubahan berikutnya. Tidak ada pesan percobaan dikirim.");
        } catch { /* inline error */ }
      }}>
        <label className="block font-semibold" htmlFor="access-slack-recipient">Tujuan Slack</label>
        <input id="access-slack-recipient" data-testid="input-access-slack" value={destination} disabled={pending}
          onChange={e => { setRecipient(e.target.value); setEditRevision(editRevision ?? data.revision); setConsent(false); setNotice(""); }}
          placeholder="ID pengguna U/W atau kanal C/G"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm" />
        <p className="text-xs text-muted-foreground">Gunakan ID pengguna Slack Anda untuk DM pribadi. Jika memilih kanal, semua anggota kanal dapat membaca pesan.</p>
        <label className="flex items-start gap-2">
          <input type="checkbox" data-testid="consent-access-slack" checked={consent} disabled={pending || stale}
            onChange={e => { setConsent(e.target.checked); setEditRevision(editRevision ?? data.revision); }} className="mt-1" />
          <span>Saya menyetujui pengiriman nama perusahaan, jenis perubahan akses, dan waktu ke tujuan ini. Tidak termasuk ID anggota/pelaku, email, isi laporan, atau konsultasi.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button data-testid="save-access-notifications" disabled={!valid || !consent || pending || stale} className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground disabled:opacity-50">
            {save.isPending ? "Menyimpan..." : data.enabled ? "Simpan tujuan" : "Aktifkan notifikasi"}
          </button>
          {data.enabled && <button type="button" data-testid="stop-access-notifications" disabled={pending} className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-50"
            onClick={async () => {
              setNotice("");
              try {
                const result = await stop.mutateAsync();
                qc.setQueryData(getGetAccessNotificationsQueryKey(), result);
                setConsent(false); setRecipient(null); setEditRevision(null);
                setNotice("Notifikasi dihentikan. Antrean yang belum dikirim dibatalkan.");
              } catch { /* inline error */ }
            }}>Hentikan notifikasi</button>}
        </div>
      </form>
      {stale && <div role="alert" className="text-destructive">Pengaturan berubah di sesi lain. Tinjau tujuan terbaru sebelum menyimpan.
        <button type="button" className="ml-2 underline" onClick={() => { setRecipient(null); setEditRevision(null); setConsent(false); }}>Muat pengaturan terbaru</button>
      </div>}
      {(save.error || stop.error) && <p role="alert" className="text-destructive">{errorMessage(save.error ?? stop.error)}</p>}
      {notice && <p role="status" className="text-primary">{notice}</p>}
      <p className="text-xs text-muted-foreground">Hasil pengiriman yang gagal atau tidak pasti tidak diulang otomatis untuk mencegah pesan ganda. Mengubah tujuan membatalkan antrean lama. Menghapus perusahaan menghapus antrean dan riwayat notifikasi, tetapi tidak menarik kembali pesan yang sudah dikirim ke Slack.</p>
      {data.deliveries.length > 0 && <div>
        <h3 className="font-semibold">10 pengiriman terbaru</h3>
        <ul className="mt-2 space-y-2 text-xs">
          {data.deliveries.map(item => <li key={item.id} className="rounded-lg bg-muted px-3 py-2">
            {labels[item.status]} · {new Date(item.updatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
          </li>)}
        </ul>
      </div>}
    </div>
  );
}
