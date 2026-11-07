import type { ConsultationSpecialist, ConsultationSpecialistProfile } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

// Label-only fallback for badges while the catalog loads. Full profile content comes from the server.
export const SPECIALIST_FALLBACK_LABEL: Record<ConsultationSpecialist, string> = {
  umum: "Umum",
  akuntansi: "Akuntansi",
  perpajakan: "Perpajakan",
  tahunan_rups: "Laporan Tahunan & RUPS",
};

export function specialistLabel(id: ConsultationSpecialist, profiles?: ConsultationSpecialistProfile[]) {
  return profiles?.find((p) => p.id === id)?.label ?? SPECIALIST_FALLBACK_LABEL[id] ?? id;
}

export function SpecialistBadge({ id, profiles, tone = "light", testId }: {
  id: ConsultationSpecialist | null | undefined; profiles?: ConsultationSpecialistProfile[]; tone?: "light" | "dark"; testId?: string;
}) {
  if (!id) {
    return <span data-testid={testId} title="Fokus pesan lama ini tidak dicatat" className={cn("inline-flex items-center rounded-md border border-dashed px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
      tone === "dark" ? "border-sky-200/40 text-sky-100/75" : "border-input text-muted-foreground")}>Fokus tidak tercatat</span>;
  }
  return <span data-testid={testId} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
    tone === "dark" ? "bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--ink))]" : "bg-accent text-accent-foreground")}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{specialistLabel(id, profiles)}
  </span>;
}

export function FocusSelector({ profiles, value, onChange, disabled }: {
  profiles: ConsultationSpecialistProfile[]; value: ConsultationSpecialist; onChange: (id: ConsultationSpecialist) => void; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Fokus pendamping" className="flex flex-wrap gap-1.5">
      {profiles.map((p) => {
        const active = p.id === value;
        return (
          <button key={p.id} type="button" role="radio" aria-checked={active} disabled={disabled} data-testid={`button-focus-${p.id}`}
            onClick={() => onChange(p.id)}
            className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50",
              active ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-[hsl(var(--sidebar-primary))] shadow-[0_6px_18px_-8px_hsl(var(--ink)/.6)]"
                : "border-input bg-card text-foreground hover:-translate-y-0.5 hover:border-primary active:translate-y-0")}>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
