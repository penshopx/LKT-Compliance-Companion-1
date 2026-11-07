import type { ReferenceReviewEvent } from "@workspace/api-client-react";

export function EvidenceArchives({ event }: { event: ReferenceReviewEvent }) {
  return <div className="mt-2 space-y-2 rounded border border-border p-2 text-xs">
    <p>Arsip adalah salinan bukti publik, bukan verifikasi ulang. Sumber asli tetap menjadi rujukan. Waktu pengambilan dapat berbeda dari tanggal pemeriksaan; tidak membuktikan isi sumber tidak berubah sejak pemeriksaan.</p>
    {!event.archives?.length ? <p className="text-muted-foreground">Belum ada salinan arsip untuk snapshot ini.</p>
      : event.archives.map(archive => <div key={archive.id} className="space-y-1">
        <a href={`${import.meta.env.BASE_URL}api/lkt/evidence-archives/${archive.id}`} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Buka arsip bukti · {archive.locator}</a>
        <p>{archive.description}</p>
        <a href={archive.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Sumber asli arsip</a>
        <p>Pemeriksaan snapshot: {archive.reviewedAt} · Diambil: {archive.capturedAt} · {archive.contentType} · {archive.byteLength} byte</p>
        <details><summary className="cursor-pointer">Checksum dan kaitan snapshot</summary>
          <p className="break-all">SHA-256 berkas: {archive.checksum}</p>
          <p className="break-all">SHA-256 snapshot: {archive.snapshotHash}</p>
          <p className="break-all">SHA-256 bukti: {archive.evidenceHash}</p>
        </details>
      </div>)}
  </div>;
}
