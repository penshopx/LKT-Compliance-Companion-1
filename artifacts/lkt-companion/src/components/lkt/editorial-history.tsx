import type { Reference } from "@workspace/api-client-react";
import { VERIFICATION_LABEL } from "./common";
import { EvidenceArchives } from "./evidence-archives";

export function EditorialHistory({ reference }: { reference: Reference }) {
  return (
    <details className="mt-2 whitespace-normal rounded border border-border p-2">
      <summary className="cursor-pointer font-semibold text-primary">Riwayat dan bukti ({reference.reviewHistory.length})</summary>
      <ol className="mt-3 space-y-4">
        {[...reference.reviewHistory].reverse().map((event, index) => (
          <li key={index} className="space-y-1 border-l-2 border-border pl-3">
            <p className="font-semibold">{event.recordedAt} (WIB) · {event.kind === "schedule" ? "Jadwal saja — bukan verifikasi ulang" : "Temuan"}</p>
            {event.actorName && <p>Dicatat oleh {event.actorName} · {event.createdAt}</p>}
            <p>Penanggung jawab: {event.editorialOwner} · Jadwal: {event.nextReviewAt}</p>
            <p>{event.changeSummary}</p>
            <p>{VERIFICATION_LABEL[event.verificationStatus]} · {event.verificationNotes}</p>
            <p>Cakupan: {event.applicability}</p><p>Periode: {event.effectivePeriod}</p>
            <p>Standar: {event.standards.join("; ") || "Tidak ditetapkan oleh sumber ini."}</p>
            {event.primarySources.map((source, sourceIndex) => (
              <div key={sourceIndex} className="pt-2">
                <a href={source.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">{source.title}</a>
                <p>{source.locator}</p><p>{source.finding}</p>
              </div>
            ))}
            <EvidenceArchives event={event} />
          </li>
        ))}
      </ol>
    </details>
  );
}
