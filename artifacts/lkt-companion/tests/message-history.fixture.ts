import { vi } from "vitest";
import type { ChatMessage, ChatMessagePage, ConsultationSpecialistProfile } from "@workspace/api-client-react";

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const profile: ConsultationSpecialistProfile = {
  id: "umum", label: "Umum", summary: "Fokus fixture",
  boundary: "Tidak memanggil AI", starters: [], referenceIds: [],
};

export function message(n: number): ChatMessage {
  return {
    id: `fixture-${n}`, role: n % 2 ? "user" : "assistant",
    content: `Pesan fixture ${n}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    specialist: "umum", referenceFreshness: "not_applicable",
  };
}

export type HistoryRequest = { before: string | null; q: string | null; signal: AbortSignal | null | undefined };

/** Installed before render; every request is intercepted and unknown routes fail closed. */
export function historyFixture() {
  let rows = Array.from({ length: 205 }, (_, i) => message(i + 1));
  const requests: HistoryRequest[] = [];
  let failNext = false;
  let gate: ReturnType<typeof deferred<Response>> | undefined;
  let held: ReturnType<typeof deferred<Response>> | undefined;
  let heldResponse: Response | undefined;
  let overlap = false;
  let posts = 0;
  let deletes = 0;
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), "http://fixture.invalid");
    const method = init?.method ?? "GET";
    if (url.pathname === "/api/lkt/consultation-specialists" && method === "GET") return json([profile]);
    if (url.pathname !== "/api/lkt/messages") throw new Error(`Unexpected fixture request: ${method} ${url.pathname}`);
    if (method === "POST") {
      posts++;
      const body = JSON.parse(String(init?.body));
      if (body.specialist !== "umum") throw new Error("Unexpected specialist");
      const user: ChatMessage = { ...message(206), role: "user", content: body.content };
      const answer: ChatMessage = { ...message(207), role: "assistant" };
      rows.push(user, answer);
      return json(answer);
    }
    if (method === "DELETE") {
      deletes++;
      rows = [];
      return new Response(null, { status: 204 });
    }
    if (method !== "GET") throw new Error(`Unexpected fixture method: ${method}`);
    if (url.searchParams.get("limit") !== "80") throw new Error("Page limit must remain 80");
    const before = url.searchParams.get("before");
    const q = url.searchParams.get("q");
    requests.push({ before, q, signal: init?.signal });
    if (failNext) { failNext = false; throw new TypeError("Fixture network offline"); }
    const matching = q ? rows.filter(row => row.content.includes(q)) : rows;
    const end = before ? matching.findIndex(row => row.id === before) : matching.length;
    if (end < 0) throw new Error(`Unknown/stale cursor: ${before}`);
    const start = Math.max(0, end - 80);
    const page: ChatMessagePage = {
      messages: matching.slice(start, end),
      nextCursor: start > 0 ? matching[start].id : null,
    };
    // Simulate a repeated boundary record from overlapping pages.
    if (overlap && before && matching[end]) page.messages.push({ ...matching[end], content: "Stale overlapping copy" });
    const response = json(page);
    if (gate) {
      held = gate;
      gate = undefined;
      heldResponse = response;
      return held.promise;
    }
    return response;
  });
  vi.stubGlobal("fetch", fetch);

  return {
    requests, fetch,
    get posts() { return posts; },
    get deletes() { return deletes; },
    failOnce() { failNext = true; },
    overlapPages() { overlap = true; },
    holdNext() { gate = deferred<Response>(); },
    release() {
      if (!held || !heldResponse) throw new Error("No held fixture response");
      const current = held;
      held = undefined;
      current.resolve(heldResponse);
      heldResponse = undefined;
    },
  };
}
