import type { ReportFindingInput, ReportFindingUpdate } from "@workspace/api-zod";

/** Calendar dates stay strings. Reject overflow such as February 30. */
export function validFindingDate(value: string | null): boolean {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function findingValidationError(value: ReportFindingInput | ReportFindingUpdate): string | null {
  if (!value.title.trim() || !value.problem.trim()) return "Judul dan uraian masalah wajib diisi.";
  if (!validFindingDate(value.targetDate)) return "Target internal harus tanggal kalender yang valid (YYYY-MM-DD), atau dikosongkan.";
  if (value.status === "ditutup" && (!value.actionResult.trim() || !value.reviewNote.trim())) {
    return "Isi hasil tindakan dan hasil telaah internal sebelum menutup temuan. Penutupan bukan persetujuan audit atau hukum.";
  }
  return null;
}

export function normalizeFinding<T extends ReportFindingInput | ReportFindingUpdate>(input: T): T {
  return Object.fromEntries(Object.entries(input).map(([key, value]) =>
    [key, typeof value === "string" ? value.trim() : value])) as T;
}
