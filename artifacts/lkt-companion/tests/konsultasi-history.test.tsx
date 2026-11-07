import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { getGetMessagesQueryKey, type ChatMessagePage } from "@workspace/api-client-react";
import KonsultasiPage from "../src/pages/konsultasi";
import { historyFixture } from "./message-history.fixture";

const key = (q = "") => [...getGetMessagesQueryKey(), "infinite", q];
let client: QueryClient;
let fixture: ReturnType<typeof historyFixture>;
let user: ReturnType<typeof userEvent.setup>;

function mount() {
  const location = memoryLocation({ path: "/konsultasi" });
  return render(
    <QueryClientProvider client={client}>
      <Router hook={location.hook}><KonsultasiPage /></Router>
    </QueryClientProvider>,
  );
}
function cache(q = "") { return client.getQueryData<InfiniteData<ChatMessagePage, string | undefined>>(key(q)); }
function ids() { return screen.queryAllByTestId(/^message-fixture-/).map(node => node.getAttribute("data-testid")); }
async function settled() { await waitFor(() => expect(client.isFetching()).toBe(0)); }
async function count(n: number) {
  await waitFor(() => expect(ids()).toHaveLength(n));
  expect(new Set(ids()).size).toBe(n);
  expect(ids()).toEqual([...ids()].sort((a, b) => Number(a!.split("-").at(-1)) - Number(b!.split("-").at(-1))));
}
async function older() { await user.click(screen.getByTestId("button-load-older")); await settled(); }
async function search(q: string) {
  await user.clear(screen.getByTestId("input-history-search"));
  await user.type(screen.getByTestId("input-history-search"), q);
  await user.click(screen.getByTestId("button-search-history"));
  await settled();
}
async function send() {
  await user.type(screen.getByTestId("input-question"), "Pertanyaan fixture baru");
  await user.click(screen.getByTestId("button-send"));
  await waitFor(() => expect(fixture.posts).toBe(1));
  await waitFor(() => expect(screen.queryByTestId("state-thinking")).toBeNull());
}

beforeEach(() => {
  // A fresh tenant-like cache and in-memory server per test. Retries are explicit
  // so failures are deterministic and do not wait for production backoff.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  fixture = historyFixture();
  user = userEvent.setup();
});
afterEach(async () => {
  cleanup();
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
});

describe("KonsultasiPage / real React Query history cache", () => {
  it("keeps every read page visible on older-page failure and retries the same cursor", async () => {
    mount(); await count(80); await settled();
    expect(fixture.requests.map(r => r.before)).toEqual([null]);
    await older(); await count(160);
    const read = ids();
    const saved = cache();
    fixture.failOnce();
    await older();
    await screen.findByRole("alert");
    expect(ids()).toEqual(read);
    expect(cache()).toBe(saved);
    expect(screen.getByTestId("button-load-older").hasAttribute("disabled")).toBe(false);
    expect(screen.queryByTestId("state-empty")).toBeNull();
    await older(); await count(205);
    expect(fixture.requests.map(r => r.before)).toEqual([null, "fixture-126", "fixture-46", "fixture-46"]);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("state-history-start")).toBeTruthy();
  });

  it("reloads from the newest page after failure, then restores all older pages", async () => {
    mount(); await count(80); await settled();
    await older();
    fixture.failOnce(); await older();
    await user.click(screen.getByRole("button", { name: "Muat ulang riwayat dari pesan terbaru" }));
    await settled(); await count(80);
    expect(cache()?.pageParams).toEqual([undefined]);
    expect(fixture.requests.at(-1)?.before).toBeNull();
    await older(); await older(); await count(205);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("recovers initial failure by retry and recovers a failed older load on a fresh reload", async () => {
    fixture.failOnce();
    const page = mount();
    await screen.findByTestId("button-retry");
    await user.click(screen.getByTestId("button-retry"));
    await count(80); await settled();
    fixture.failOnce(); await older();
    await screen.findByRole("alert");
    page.unmount();
    await client.cancelQueries();
    client.clear(); // fresh browser reload: no persisted React Query cache
    mount(); await count(80); await settled();
    expect(fixture.requests.at(-1)?.before).toBeNull();
    await older(); await older(); await count(205);
  });

  it("refetches new messages with fresh boundaries, no duplicates, and a reachable oldest page", async () => {
    mount(); await count(80); await settled(); await older(); await count(160);
    const offset = fixture.requests.length;
    await send(); await settled(); await count(160);
    expect(fixture.requests.slice(offset).map(r => r.before)).toEqual([null, "fixture-128"]);
    expect(cache()?.pageParams).toEqual([undefined, "fixture-128"]);
    expect(cache()?.pages.map(p => p.nextCursor)).toEqual(["fixture-128", "fixture-48"]);
    expect(screen.getByTestId("message-fixture-207")).toBeTruthy();
    await older(); await count(207);
    expect(ids()[0]).toBe("message-fixture-1");
    expect(screen.getByTestId("state-history-start")).toBeTruthy();
  });

  it("keeps cached pages during a failed post-send refetch and recovers on retry", async () => {
    mount(); await count(80); await settled(); await older(); await count(160);
    const read = ids();
    fixture.failOnce();
    await send(); await settled();
    await screen.findByRole("alert");
    expect(ids()).toEqual(read);
    expect(cache()?.pageParams).toEqual([undefined, "fixture-126"]);
    await act(async () => { await client.invalidateQueries({ queryKey: getGetMessagesQueryKey() }); });
    await settled(); await count(160);
    expect(screen.queryByRole("alert")).toBeNull();
    await older(); await count(207);
  });

  it("cancels an in-flight older load when send invalidates history, ignoring its late stale result", async () => {
    mount(); await count(80); await settled();
    fixture.holdNext();
    await user.click(screen.getByTestId("button-load-older"));
    await waitFor(() => expect(fixture.requests).toHaveLength(2));
    const request = fixture.requests[1];
    expect(screen.getByTestId("button-load-older").hasAttribute("disabled")).toBe(true);
    await send();
    await waitFor(() => expect(request.signal?.aborted).toBe(true));
    // Release the old snapshot even though the network ignored cancellation.
    fixture.release();
    await settled(); await count(80);
    expect(cache()?.pageParams).toEqual([undefined]);
    expect(cache()?.pages[0].nextCursor).toBe("fixture-128");
    expect(screen.getByTestId("message-fixture-207")).toBeTruthy();
    await older(); await older(); await count(207);
  });

  it("renders a repeated boundary record only once, preferring the newest copy", async () => {
    fixture.overlapPages();
    mount(); await count(80); await settled(); await older(); await count(160);
    expect(screen.queryByText("Stale overlapping copy")).toBeNull();
    await older(); await count(205);
    expect(screen.queryByText("Stale overlapping copy")).toBeNull();
  });

  it("clears every cached search cursor as well as the active history, even during an older load", async () => {
    mount(); await count(80); await settled();
    await search("Pesan fixture"); await count(80); await older(); await count(160);
    expect(cache("Pesan fixture")?.pageParams).toHaveLength(2);
    await user.click(screen.getByTestId("button-reset-history-search"));
    await settled(); await count(80);
    await older(); await count(160);
    fixture.holdNext();
    await user.click(screen.getByTestId("button-load-older"));
    await waitFor(() => expect(client.isFetching()).toBe(1));
    const pending = fixture.requests.at(-1)!;
    const offset = fixture.requests.length;
    await user.click(screen.getByTestId("button-clear-messages"));
    await user.click(await screen.findByTestId("button-confirm-clear"));
    await waitFor(() => expect(fixture.deletes).toBe(1));
    await waitFor(() => expect(pending.signal?.aborted).toBe(true));
    fixture.release();
    await settled();
    await screen.findByText("Belum ada percakapan");
    expect(ids()).toEqual([]);
    expect(cache()?.pageParams).toEqual([undefined]);
    expect(cache()?.pages).toEqual([{ messages: [], nextCursor: null }]);
    expect(cache("Pesan fixture")).toBeUndefined();
    expect(fixture.requests.slice(offset).every(r => r.before === null)).toBe(true);
    await search("Pesan fixture");
    await screen.findByText("Tidak ada pesan yang cocok");
    expect(cache("Pesan fixture")?.pageParams).toEqual([undefined]);
    expect(screen.queryByTestId("button-load-older")).toBeNull();
  });
});
