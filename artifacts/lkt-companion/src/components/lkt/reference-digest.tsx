import { useState } from "react";
import {
  getGetReferenceDigestQueryKey, useGetReferenceDigest, useSaveReferenceDigest, useStopReferenceDigest,
  type ReferenceDigestConfig, type ReferenceDigest, type ReferenceDigestTopic,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing } from "lucide-react";
import { errorMessage, ErrorState } from "./common";
import { useToast } from "@/hooks/use-toast";

const weekdays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const topics: Record<ReferenceDigestTopic, string> = {
  all: "Seluruh pustaka", tax: "Perpajakan", capital_market: "Pasar modal", accounting_standards: "Standar akuntansi",
};
const statuses: Record<string, string> = {
  sending: "Sedang dikirim", delivered: "Diterima Slack", retry: "Menunggu percobaan ulang",
  failed: "Gagal", uncertain: "Belum pasti — periksa Slack", cancelled: "Dibatalkan", empty: "Tidak ada yang perlu dikirim",
};

export function ReferenceDigestPanel() {
  const query = useGetReferenceDigest({ query: { staleTime: 30_000, refetchInterval: 30_000 } });
  return <section aria-labelledby="digest-title" data-testid="reference-digest-panel" className="mb-5 rounded-xl border border-card-border bg-card p-4">
    <h2 id="digest-title" className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-primary" />Ringkasan terjadwal ke tim</h2>
    <p className="mt-2 text-sm text-muted-foreground">Terima pengingat referensi yang jatuh jadwal, lewat jadwal, perlu ditinjau, atau usang melalui Slack. Hanya metadata pustaka bersama yang dikirim; tidak ada profil, catatan, atau percakapan perusahaan.</p>
    {query.isLoading ? <p className="mt-3 text-sm" role="status">Memuat pengaturan…</p>
      : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
      : query.data && <>
        <p className="mt-3 text-sm" role="status"><b>{query.data.config.enabled ? "Aktif" : "Nonaktif"}</b>
          {query.data.config.recipientLabel && <> · {query.data.config.recipientLabel} · {query.data.config.cadence === "daily" ? "Setiap hari" : `Setiap ${weekdays[query.data.config.weekday]}`} pukul {query.data.config.timeWib} WIB</>}
          {" · "}{topics[query.data.config.topic]}
        </p>
        {query.data.config.pauseReason && <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{query.data.config.pauseReason}</p>}
        {query.data.canManage
          ? <DigestForm key={query.data.config.revision} config={query.data.config} />
          : <p className="mt-3 text-sm text-muted-foreground">Hanya pemilik perusahaan dapat memilih penerima, mengaktifkan jadwal, atau berhenti berlangganan untuk tim. Hubungi pemilik untuk menghentikan pengingat.</p>}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-primary">Riwayat pengiriman terakhir ({query.data.deliveries.length})</summary>
          {!query.data.deliveries.length ? <p className="mt-2 text-muted-foreground">Belum ada pengiriman. Tidak ada pesan uji yang dikirim saat menyimpan pengaturan.</p>
            : <ul className="mt-2 space-y-2">{query.data.deliveries.map(delivery => <li key={delivery.id} className="rounded-lg border border-border p-3">
              <b>{delivery.day} WIB · {statuses[delivery.status]}</b><span className="text-muted-foreground"> · {delivery.attempts} percobaan</span>
              {delivery.detail && <p className="mt-1 text-muted-foreground">{delivery.detail}</p>}
            </li>)}</ul>}
        </details>
      </>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Zona waktu tetap Asia/Jakarta (WIB, UTC+7). Pengiriman pertama pada jadwal berikutnya setelah aktivasi; maksimal satu ringkasan per perusahaan per hari WIB, termasuk setelah mengganti tujuan. Jadwal bekerja selama server aplikasi berjalan; periode yang terlewat tidak dikirim susulan. Hanya penolakan batas Slack dicoba ulang, maksimal tiga percobaan dalam hari yang sama. Hasil tidak pasti tidak dikirim ulang otomatis. Penerimaan pesan bukan verifikasi sumber dan tidak mengubah status atau jadwal tinjau.</p>
  </section>;
}

function DigestForm({ config }: { config: ReferenceDigestConfig }) {
  const [recipient, setRecipient] = useState(config.recipient);
  const [cadence, setCadence] = useState(config.cadence);
  const [weekday, setWeekday] = useState(config.weekday);
  const [timeWib, setTimeWib] = useState(config.timeWib);
  const [topic, setTopic] = useState(config.topic);
  const [consent, setConsent] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const success = (data: ReferenceDigest) => {
    qc.setQueryData(getGetReferenceDigestQueryKey(), data);
    void qc.invalidateQueries({ queryKey: getGetReferenceDigestQueryKey() });
  };
  const save = useSaveReferenceDigest({ mutation: {
    onSuccess: data => { success(data); toast({ title: "Jadwal aktif", description: "Pengiriman dimulai pada jadwal berikutnya, tanpa pesan uji." }); },
    onError: error => toast({ variant: "destructive", title: "Jadwal belum disimpan", description: errorMessage(error) }),
  } });
  const stop = useStopReferenceDigest({ mutation: {
    onSuccess: data => { success(data); toast({ title: "Berhenti berlangganan", description: "Pengiriman berikutnya dan percobaan ulang telah dihentikan. Pesan yang sudah diterima Slack tidak ditarik kembali." }); },
    onError: error => toast({ variant: "destructive", title: "Belum berhenti berlangganan", description: errorMessage(error) }),
  } });
  const pending = save.isPending || stop.isPending;
  const inputClass = "mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return <form className="mt-4 space-y-3" onSubmit={event => {
    event.preventDefault();
    save.mutate({ data: { expectedRevision: config.revision, channel: "slack", recipient: recipient.trim(), cadence, weekday, timeWib, topic, consent: true } });
  }}>
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">Kanal pengiriman
        <select aria-label="Kanal pengiriman" className={inputClass} value="slack" onChange={() => {}}><option value="slack">Slack — integrasi yang disetujui</option></select>
      </label>
      <label className="text-xs font-semibold">Tujuan / penerima Slack
        <input data-testid="digest-recipient" className={inputClass} value={recipient} onChange={e => { setRecipient(e.target.value); setConsent(false); }}
          required pattern="[CGUW][A-Z0-9]{8,30}" placeholder="ID kanal C… / G… atau pengguna U… / W…" />
      </label>
      <label className="text-xs font-semibold">Frekuensi
        <select data-testid="digest-cadence" className={inputClass} value={cadence} onChange={e => setCadence(e.target.value as "daily" | "weekly")}>
          <option value="daily">Harian</option><option value="weekly">Mingguan</option>
        </select>
      </label>
      <label className="text-xs font-semibold">Topik referensi
        <select data-testid="digest-topic" className={inputClass} value={topic} onChange={e => { setTopic(e.target.value as ReferenceDigestTopic); setConsent(false); }}>
          {Object.entries(topics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold">Jam WIB
        <input data-testid="digest-time" className={inputClass} type="time" value={timeWib} required onChange={e => setTimeWib(e.target.value)} />
      </label>
      {cadence === "weekly" && <label className="text-xs font-semibold">Hari
        <select data-testid="digest-weekday" className={inputClass} value={weekday} onChange={e => setWeekday(Number(e.target.value))}>
          {weekdays.map((day, i) => <option key={day} value={i}>{day}</option>)}
        </select>
      </label>}
    </fieldset>
    <p className="text-xs text-muted-foreground">Topik tersimpan untuk perusahaan ini. Perpajakan mengikuti jenis laporan SPT; pasar modal mengikuti cakupan emiten/perusahaan publik; standar akuntansi mengikuti metadata SAK. Pilihan topik bukan penetapan kewajiban perusahaan. Hanya referensi dalam topik yang jatuh jadwal, perlu ditinjau, atau usang yang dikirim. Perubahan membatalkan percobaan ulang tertunda tanpa mengirim ulang ringkasan hari ini.</p>
    <p className="text-xs text-muted-foreground">Salin ID kanal dari detail kanal Slack. Penerima kanal adalah seluruh anggotanya; untuk pesan pribadi, salin ID anggota dari profil Slack. Akun integrasi harus sudah dapat mengakses tujuan. Validasi tidak mengirim pesan, tetapi dapat membuka percakapan DM.</p>
    <label className="flex items-start gap-2 text-sm">
      <input data-testid="digest-consent" className="mt-1" type="checkbox" required checked={consent} disabled={pending} onChange={e => setConsent(e.target.checked)} />
      <span>Saya menyetujui ringkasan metadata pustaka untuk topik {topics[topic]} dikirim ke tujuan di atas dan berwenang memilih penerima tim.</span>
    </label>
    <div className="flex flex-wrap gap-2">
      <button data-testid="digest-save" disabled={pending || !consent} type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Memvalidasi dan menyimpan…" : config.enabled ? "Simpan perubahan jadwal" : "Aktifkan jadwal"}
      </button>
      {config.enabled && <button data-testid="digest-stop" disabled={pending} type="button" onClick={() => stop.mutate()}
        className="rounded-lg border border-input px-4 py-2 text-sm font-semibold disabled:opacity-50">{stop.isPending ? "Menghentikan…" : "Berhenti berlangganan"}</button>}
    </div>
  </form>;
}
