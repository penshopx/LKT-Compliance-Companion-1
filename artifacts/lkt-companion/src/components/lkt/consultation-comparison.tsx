import { useGetConsultationMessage, type ChatMessage, type ConsultationSpecialistProfile } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState, fmtDate, Shimmer } from "./common";
import { ConsultationReferenceNote } from "./consultation-reference-note";
import { SpecialistBadge } from "./specialist-ui";

export function ConsultationComparison({ answerId, onClose, profiles }: {
  answerId: string; onClose: () => void; profiles: ConsultationSpecialistProfile[];
}) {
  const answer = useGetConsultationMessage(answerId, { query: { staleTime: 0, refetchOnMount: "always" } });
  const sourceId = answer.data?.reconsultedFromId;
  const source = useGetConsultationMessage(sourceId ?? "", { query: { enabled: !!sourceId, staleTime: 0, refetchOnMount: "always" } });
  const renderAnswer = (message: ChatMessage, label: string) => (
    <section className="min-w-0 rounded-xl border border-border p-4" data-testid={`comparison-${message.id}`}>
      <h3 className="mb-2 font-semibold">{label}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{fmtDate(message.createdAt)}</p>
      <SpecialistBadge id={message.specialist} profiles={profiles} />
      <p className="my-3 whitespace-pre-wrap text-sm"><b>Pertanyaan:</b> {message.originalQuestion?.content ?? "Pasangan pertanyaan tidak dapat dipastikan."}</p>
      <ConsultationReferenceNote message={message} />
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
    </section>
  );
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Bandingkan jawaban konsultasi</DialogTitle>
          <DialogDescription>Jawaban dan snapshot asal tetap tersimpan tanpa perubahan. Hasil konsultasi ulang tidak otomatis lebih benar atau lebih mutakhir secara hukum. Verifikasi keduanya ke sumber resmi.</DialogDescription>
        </DialogHeader>
        {answer.isError ? <ErrorState error={answer.error} onRetry={() => answer.refetch()} />
          : answer.isLoading ? <Shimmer className="h-32" />
          : !sourceId ? <p role="alert">Jawaban ini tidak memiliki hubungan konsultasi ulang yang tercatat.</p>
          : source.isError ? <ErrorState title="Jawaban asal tidak tersedia" error={source.error} onRetry={() => source.refetch()} />
          : source.isLoading ? <Shimmer className="h-32" />
          : answer.data && source.data ? <div className="grid gap-4 md:grid-cols-2">
            {renderAnswer(source.data, "Jawaban asal")}
            {renderAnswer(answer.data, "Hasil konsultasi ulang")}
          </div> : null}
      </DialogContent>
    </Dialog>
  );
}
