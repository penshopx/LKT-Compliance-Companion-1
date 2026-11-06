import type { ChatMessage } from "@workspace/api-client-react";
import { fmtDate, VERIFICATION_LABEL } from "./common";

export function ConsultationReferenceNote({ message }: { message: ChatMessage }) {
  if (message.role !== "assistant") return null;
  const snapshot = message.referenceSnapshot;
  const missing = !snapshot || !message.referenceFreshness || message.referenceFreshness === "missing";
  const changed = !missing && message.referenceFreshness !== "current";
  return (
    <div data-testid={`reference-note-${message.id}`} className="mb-3 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed">
      {missing ? (
        <p role="note" className="font-semibold text-[hsl(30_90%_30%)]">Peringatan: jawaban lama tanpa snapshot rujukan. Tanggal dan status rujukan saat jawaban dibuat tidak diketahui. Periksa pustaka dan ajukan pertanyaan baru sebelum memakai jawaban ini.</p>
      ) : (
        <>
          {changed ? (
            <p role="note" className="mb-2 font-semibold text-[hsl(30_90%_30%)]">Peringatan: catatan rujukan telah berubah sejak jawaban ini dibuat. Jawaban belum diperbarui. Periksa pustaka dan ajukan pertanyaan baru sebelum menggunakannya.</p>
          ) : <p className="font-semibold">Snapshot cocok dengan versi catatan rujukan yang tersedia di aplikasi.</p>}
          <p className="mt-1 text-muted-foreground">Snapshot dicatat {fmtDate(snapshot.capturedAt)}. Kecocokan versi bukan jaminan kebenaran atau kepatuhan. Bukan pencarian web langsung.</p>
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold text-primary">Lihat tanggal dan status rujukan saat menjawab</summary>
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">Versi: {snapshot.knowledgeVersion}</p>
            <p className="mt-1 text-muted-foreground">Seluruh catatan yang diberikan ke AI, bukan daftar sumber yang pasti dikutip.</p>
            <ul className="mt-2 space-y-2">
              {snapshot.references.map(r => <li key={r.id}><b>{r.title}</b><br />Ditinjau {r.reviewedAt} · {VERIFICATION_LABEL[r.verificationStatus]}</li>)}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
