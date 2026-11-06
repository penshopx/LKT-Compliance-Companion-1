import { createHash } from "node:crypto";
import type { LktReferenceSnapshot } from "@workspace/db";
import type { Reference } from "@workspace/api-zod";

// This exact projection is both sent to the model and versioned. Reminder clocks,
// bookmarks and other presentation-only fields must not invalidate old answers.
export function consultationReferenceContext(sources: Reference[]) {
  return sources.map(({ id, title, publisher, url, scope, verificationStatus, reviewedAt,
    applicability, effectivePeriod, standards, verificationNotes, primarySources }) => ({
    id, title, publisher, url, scope, verificationStatus, reviewedAt,
    applicability, effectivePeriod, standards, verificationNotes, primarySources,
  })).sort((a, b) => a.id.localeCompare(b.id));
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function createReferenceSnapshot(sources: Reference[], now = new Date()): LktReferenceSnapshot {
  const context = consultationReferenceContext(sources);
  return {
    capturedAt: now.toISOString(),
    knowledgeVersion: `sha256:${createHash("sha256").update(canonical(context)).digest("hex")}`,
    references: context.map(({ id, title, reviewedAt, verificationStatus }) => ({
      id, title, reviewedAt, verificationStatus,
    })),
  };
}

export function referenceFreshness(
  role: "user" | "assistant",
  snapshot: LktReferenceSnapshot | null,
  currentVersion: string,
): "not_applicable" | "missing" | "current" | "changed" {
  if (role !== "assistant") return "not_applicable";
  if (!snapshot) return "missing";
  return snapshot.knowledgeVersion === currentVersion ? "current" : "changed";
}
