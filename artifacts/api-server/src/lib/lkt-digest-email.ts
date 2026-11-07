import { ReplitConnectors } from "@replit/connectors-sdk";
import { LktAccessError } from "./lkt-ai-limits";
import type { SendOutcome } from "./lkt-digest-slack";

const connectors = new ReplitConnectors();
type Proxy = ReplitConnectors["proxy"];
const proxyResend: Proxy = (...args) => connectors.proxy(...args);
export const mailboxPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
export function validMailbox(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254 || !mailboxPattern.test(value)) return false;
  const [local, domain] = value.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..")
    && domain.split(".").every(label => label.length <= 63 && !label.startsWith("-") && !label.endsWith("-"));
}
export type EmailDestination = {
  connectionId: string; sender: string | null; senderDomainId: string | null; recipient: string;
};
async function readResend(connectionId: string, path: string, proxy: Proxy) {
  const response = await proxy("resend", path, { connectionId, signal: AbortSignal.timeout(15_000), method: "GET" });
  if (!response.ok) throw new Error("Resend validation rejected");
  return await response.json() as Record<string, unknown>;
}
async function validateDomain(connectionId: string, id: string, sender: string, proxy: Proxy) {
  const domain = await readResend(connectionId, `/domains/${encodeURIComponent(id)}`, proxy);
  const capabilities = domain.capabilities as { sending?: string } | undefined;
  if (domain.id !== id || domain.name !== sender.split("@")[1] || domain.status !== "verified"
    || capabilities?.sending !== "enabled") throw new Error("Sender domain not verified for sending");
}
export async function resolveEmailDestination(recipient: string, sender?: string) {
  if (!validMailbox(recipient) || !validMailbox(sender)) throw new LktAccessError(400, "Isi satu alamat email penerima dan pengirim yang valid, tanpa nama tampilan.");
  try {
    const connections = await connectors.listConnections({ connector_names: "resend", signal: AbortSignal.timeout(15_000) });
    if (connections.length !== 1) throw new Error("Ambiguous connection");
    const connectionId = connections[0].id;
    let after = "";
    let senderDomainId: string | undefined;
    // Paginate, but fail closed on excessively large/unexpected account listings.
    for (let page = 0; page < 20; page++) {
      const result = await readResend(connectionId, `/domains?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`, proxyResend);
      const domains = result.data as { id: string; name: string }[];
      if (!Array.isArray(domains)) throw new Error("Invalid domain list");
      senderDomainId = domains.find(d => d.name === sender.split("@")[1])?.id;
      if (senderDomainId || result.has_more !== true || !domains.length) break;
      after = domains.at(-1)!.id;
    }
    if (!senderDomainId) throw new Error("Unknown domain");
    await validateDomain(connectionId, senderDomainId, sender, proxyResend);
    return { connectionId, senderDomainId, sender, recipientLabel: recipient, slackChannelId: "", slackTeamId: "" };
  } catch {
    throw new LktAccessError(503, "Resend belum dapat memvalidasi domain pengirim. Periksa satu koneksi yang disetujui, izin baca domain, dan domain dengan pengiriman terverifikasi. Tidak ada email dikirim.");
  }
}

export async function sendEmailDigest(destination: EmailDestination, text: string, deliveryId: string, proxy = proxyResend): Promise<SendOutcome> {
  try {
    if (!validMailbox(destination.sender) || !validMailbox(destination.recipient) || !destination.senderDomainId) throw new Error("Invalid mailbox");
    await validateDomain(destination.connectionId, destination.senderDomainId, destination.sender, proxy);
  } catch {
    return { status: "failed", detail: "Koneksi atau domain pengirim Resend berubah/tidak terverifikasi. Konfigurasikan ulang." };
  }
  try {
    const response = await proxy("resend", "/emails", {
      connectionId: destination.connectionId, signal: AbortSignal.timeout(15_000), method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": `lkt-reference-digest/${deliveryId}` },
      body: {
        from: destination.sender!, to: [destination.recipient],
        subject: "LKTara — ringkasan referensi",
        text,
      },
    });
    if (response.status === 429) return { status: "retry", detail: "Resend menolak karena batas pengiriman; percobaan ulang terjadwal.", retrySeconds: Math.max(60, Number(response.headers.get("retry-after")) || 60) };
    const result = await response.json() as { id?: unknown; name?: unknown };
    if (response.ok && typeof result.id === "string" && /^[a-f0-9-]{36}$/i.test(result.id)) {
      // Acceptance is not proof of inbox delivery; retain provider ID for inspection.
      return { status: "delivered", detail: `Diterima Resend (${result.id}); bukan bukti masuk kotak surat atau dibaca.` };
    }
    if ([400, 401, 403, 404, 422].includes(response.status) && typeof result.name === "string") {
      return { status: "failed", detail: "Resend menolak email. Periksa integrasi, domain pengirim, dan alamat penerima." };
    }
    return { status: "uncertain", detail: "Hasil Resend belum pasti. Periksa penyedia; tidak dikirim ulang otomatis." };
  } catch {
    return { status: "uncertain", detail: "Koneksi terputus saat mengirim email. Periksa Resend; tidak dikirim ulang otomatis." };
  }
}
