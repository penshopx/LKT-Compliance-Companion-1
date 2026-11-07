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
  sending: "Sedang dikirim", delivered: "Diterima penyedia", retry: "Menunggu percobaan ulang",
  failed: "Gagal", uncertain: "Belum pasti — periksa penyedia", cancelled: "Dibatalkan", empty: "Tidak ada yang perlu dikirim",
};

export function ReferenceDigestPanel() {
  const [consentLink, setConsentLink] = useState<{ revision: number; url: string } | null>(null);
  const query = useGetReferenceDigest({ query: { staleTime: 30_000, refetchInterval: 30_000 } });
  return <section aria-labelledby="digest-title" data-testid="reference-digest-panel" className="mb-5 rounded-xl border border-card-border bg-card p-4">
    <h2 id="digest-title" className="flex items-center gap-2 font-semibold"><BellRing className="h-4 w-4 text-primary" />Ringkasan terjadwal ke tim</h2>
    <p className="mt-2 text-sm text-muted-foreground">Terima pengingat referensi yang jatuh jadwal, lewat jadwal, perlu ditinjau, atau usang melalui Slack atau email Resend yang disetujui. Hanya metadata pustaka bersama yang dikirim; tidak ada profil, catatan, atau percakapan perusahaan.</p>
    {query.isLoading ? <p className="mt-3 text-sm" role="status">Memuat pengaturan…</p>
      : query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} />
      : query.data && <>
        <p className="mt-3 text-sm" role="status"><b>{query.data.config.enabled ? "Aktif" : "Nonaktif"}</b>
          {query.data.config.recipientLabel && <> · {query.data.config.recipientLabel} · {query.data.config.cadence === "daily" ? "Setiap hari" : `Setiap ${weekdays[query.data.config.weekday]}`} pukul {query.data.config.timeWib} WIB</>}
          {" · "}{topics[query.data.config.topic]}
        </p>
        {query.data.config.pauseReason && <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">{query.data.config.pauseReason}</p>}
        {query.data.canManage && consentLink?.revision === query.data.config.revision && <div className="mt-3 rounded-lg border border-primary/30 p-3 text-sm">
          <p>Bagikan tautan pribadi ini secara manual hanya kepada penerima yang dimaksud. Penerima perlu membukanya dan menyetujui langganan. Jangan setujui atas nama penerima lain. Tautan hanya ditampilkan setelah penyimpanan; simpan ulang untuk menggantinya jika hilang. Tidak ada email konfirmasi/uji yang dikirim otomatis.</p>
          <input aria-label="Tautan persetujuan penerima" className="mt-2 w-full rounded border border-input bg-background p-2" readOnly value={consentLink.url} onFocus={e => e.target.select()} />
        </div>}
        {query.data.canManage
          ? <DigestForm key={query.data.config.revision} config={query.data.config} onSaved={data => setConsentLink(data.consentUrl ? { revision: data.config.revision, url: data.consentUrl } : null)} />
          : <p className="mt-3 text-sm text-muted-foreground">Hanya pemilik perusahaan dapat memilih penerima, mengaktifkan jadwal, atau berhenti berlangganan untuk tim. Hubungi pemilik untuk menghentikan pengingat.</p>}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-primary">Riwayat pengiriman terakhir ({query.data.deliveries.length})</summary>
          {!query.data.deliveries.length ? <p className="mt-2 text-muted-foreground">Belum ada pengiriman. Tidak ada pesan uji yang dikirim saat menyimpan pengaturan.</p>
            : <ul className="mt-2 space-y-2">{query.data.deliveries.map(delivery => <li key={delivery.id} className="rounded-lg border border-border p-3">
              <b>{delivery.day} WIB · {delivery.channel === "email" ? "Email" : "Slack"} · {statuses[delivery.status]}</b><span className="text-muted-foreground"> · {delivery.attempts} percobaan</span>
              {delivery.detail && <p className="mt-1 text-muted-foreground">{delivery.detail}</p>}
            </li>)}</ul>}
        </details>
      </>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Zona waktu tetap Asia/Jakarta (WIB, UTC+7). Pengiriman pertama pada jadwal berikutnya setelah aktivasi/persetujuan penerima; maksimal satu ringkasan per perusahaan per hari WIB, termasuk setelah mengganti kanal atau tujuan. Jadwal bekerja selama server aplikasi berjalan; periode yang terlewat tidak dikirim susulan. Hanya penolakan batas penyedia dicoba ulang, maksimal tiga percobaan dalam hari yang sama. Hasil tidak pasti tidak dikirim ulang otomatis. Resend menyimpan kunci idempotensi selama 24 jam; aplikasi tetap tidak mengulang hasil ambigu. Diterima Resend bukan bukti masuk kotak surat atau dibaca. Penerimaan pesan bukan verifikasi sumber dan tidak mengubah status atau jadwal tinjau.</p>
  </section>;
}

function DigestForm({ config, onSaved }: { config: ReferenceDigestConfig; onSaved: (data: ReferenceDigest) => void }) {
  const [channel, setChannel] = useState(config.channel);
  const [sender, setSender] = useState(config.sender ?? "");
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
    onSaved(data);
  };
  const save = useSaveReferenceDigest({ mutation: {
    onSuccess: data => { success(data); toast({ title: data.config.enabled ? "Jadwal aktif" : "Menunggu persetujuan penerima", description: data.config.enabled ? "Pengiriman dimulai pada jadwal berikutnya, tanpa pesan uji." : "Bagikan tautan konfirmasi secara manual. Email tetap nonaktif sampai penerima menyetujui." }); },
    onError: error => toast({ variant: "destructive", title: "Jadwal belum disimpan", description: errorMessage(error) }),
  } });
  const stop = useStopReferenceDigest({ mutation: {
    onSuccess: data => { success(data); toast({ title: "Berhenti berlangganan", description: "Pengiriman berikutnya dan percobaan ulang telah dihentikan. Pesan yang sudah diterima penyedia tidak ditarik kembali." }); },
    onError: error => toast({ variant: "destructive", title: "Belum berhenti berlangganan", description: errorMessage(error) }),
  } });
  const pending = save.isPending || stop.isPending;
  const inputClass = "mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return <form className="mt-4 space-y-3" onSubmit={event => {
    event.preventDefault();
    if (!consent) return;
    save.mutate({ data: { expectedRevision: config.revision, channel, ...(channel === "email" ? { sender: sender.trim() } : {}), recipient: recipient.trim(), cadence, weekday, timeWib, topic, consent: true } });
  }}>
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-semibold">Kanal pengiriman
        <select aria-label="Kanal pengiriman" className={inputClass} value={channel} onChange={e => { setChannel(e.target.value as "slack" | "email"); setRecipient(""); setConsent(false); }}>
          <option value="slack">Slack — integrasi yang disetujui</option><option value="email">Email — Resend yang disetujui</option>
        </select>
      </label>
      <label className="text-xs font-semibold">Tujuan / penerima {channel === "email" ? "email" : "Slack"}
        <input data-testid="digest-recipient" className={inputClass} value={recipient} onChange={e => { setRecipient(e.target.value); setConsent(false); }}
          type={channel === "email" ? "email" : "text"} maxLength={254}
          required pattern={channel === "slack" ? "[CGUW][A-Z0-9]{8,30}" : undefined} placeholder={channel === "email" ? "penerima@perusahaan.co.id" : "ID kanal C… / G… atau pengguna U… / W…"} />
      </label>
      {channel === "email" && <label className="text-xs font-semibold">Alamat pengirim — domain Resend terverifikasi
        <input aria-label="Alamat pengirim email" type="email" required maxLength={254} className={inputClass} value={sender} onChange={e => { setSender(e.target.value); setConsent(false); }} placeholder="ringkasan@domain-terverifikasi.co.id" />
      </label>}
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
    <p className="text-xs text-muted-foreground">{channel === "email"
      ? "Satu penerima per jadwal. Pengirim harus memakai domain Resend terverifikasi dengan pengiriman aktif; validasi membutuhkan izin baca domain. Menyimpan tidak mengirim email atau mengaktifkan jadwal: bagikan tautan konfirmasi secara manual. Penerima dapat berhenti tanpa akun melalui tautan di setiap email. Perubahan apa pun membutuhkan persetujuan penerima baru. Untuk alamat bersama/grup, persetujuan harus mewakili seluruh anggota. Tautan harus dapat diakses penerima; preview privat mungkin memerlukan akses Replit."
      : "Salin ID kanal dari detail kanal Slack. Penerima kanal adalah seluruh anggotanya; untuk pesan pribadi, salin ID anggota dari profil Slack. Akun integrasi harus sudah dapat mengakses tujuan. Validasi tidak mengirim pesan, tetapi dapat membuka percakapan DM."}</p>
    <label className="flex items-start gap-2 text-sm">
      <input data-testid="digest-consent" className="mt-1" type="checkbox" required checked={consent} disabled={pending} onChange={e => setConsent(e.target.checked)} />
      <span>Saya menyetujui ringkasan metadata pustaka untuk topik {topics[topic]} dikirim ke tujuan di atas dan berwenang memilih penerima tim.{channel === "email" && " Saya mendapat izin penerima dan akan meminta penerima mengonfirmasi sendiri melalui tautan pribadi."}</span>
    </label>
    <div className="flex flex-wrap gap-2">
      <button data-testid="digest-save" disabled={pending || !consent} type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
        {save.isPending ? "Memvalidasi dan menyimpan…" : channel === "email" ? "Simpan dan minta persetujuan penerima" : config.enabled ? "Simpan perubahan jadwal" : "Aktifkan jadwal"}
      </button>
      {(config.enabled || (config.channel === "email" && config.recipient)) && <button data-testid="digest-stop" disabled={pending} type="button" onClick={() => stop.mutate()}
        className="rounded-lg border border-input px-4 py-2 text-sm font-semibold disabled:opacity-50">{stop.isPending ? "Menghentikan…" : "Berhenti berlangganan"}</button>}
    </div>
  </form>;
}
