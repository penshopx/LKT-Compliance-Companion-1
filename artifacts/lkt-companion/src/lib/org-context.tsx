import { createContext, useContext } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { LktAccount, Organization } from "@workspace/api-client-react";

export type OrgContextValue = {
  userId: string;
  account: LktAccount;
  org: Organization;
  rootClient: QueryClient;
  refreshAccount: () => Promise<unknown>;
  selectOrg: (id: string | null) => void;
  denyOrg: (id: string) => void;
};

export const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg harus dipakai di dalam ruang kerja perusahaan");
  return ctx;
}

export function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status?: unknown }).status;
    return typeof s === "number" ? s : undefined;
  }
  return undefined;
}

export const ROLE_LABEL: Record<string, string> = { owner: "Pemilik", member: "Anggota" };
