import { ReplitConnectors } from "@replit/connectors-sdk";
import { LktAccessError } from "./lkt-ai-limits";

const connectors = new ReplitConnectors();
type SlackProxy = ReplitConnectors["proxy"];
const proxySlack: SlackProxy = (...args) => connectors.proxy(...args);
export type SlackDestination = {
  recipientLabel: string; slackChannelId: string; slackTeamId: string; connectionId: string;
};
export type SendOutcome =
  | { status: "delivered"; detail: null }
  | { status: "retry" | "failed" | "uncertain"; detail: string; retrySeconds?: number };

type SlackData = {
  ok?: boolean; error?: string; ts?: string; team_id?: string;
  user?: { deleted?: boolean; is_bot?: boolean; team_id?: string; real_name?: string; name?: string };
  channel?: { id?: string; name?: string; is_archived?: boolean; is_member?: boolean; is_im?: boolean; is_mpim?: boolean };
};
function slackData(value: unknown): SlackData {
  if (!value || typeof value !== "object") throw new Error("Invalid Slack response");
  return value as SlackData;
}
async function readSlack(connectionId: string, path: string, body?: object, proxy = proxySlack): Promise<SlackData> {
  const response = await proxy("slack", path, {
    connectionId, signal: AbortSignal.timeout(15_000),
    method: body ? "POST" : "GET", ...(body ? { body, headers: { "Content-Type": "application/json" } } : {}),
  });
  const data = slackData(await response.json());
  if (!response.ok || data.ok !== true) {
    throw new LktAccessError(503, "Slack tidak dapat memvalidasi tujuan. Periksa koneksi, izin, dan keanggotaan kanal lalu coba lagi.");
  }
  return data;
}

export async function resolveSlackDestination(recipient: string): Promise<SlackDestination> {
  try {
    const connections = await connectors.listConnections({ connector_names: "slack", signal: AbortSignal.timeout(15_000) });
    if (connections.length !== 1) throw new LktAccessError(503, "Siapkan tepat satu koneksi Slack yang disetujui untuk aplikasi ini.");
    const connectionId = connections[0].id;
    const identity = await readSlack(connectionId, "/auth.test", {});
    if (typeof identity.team_id !== "string") throw new Error("Missing Slack team");
    let slackChannelId = recipient;
    let recipientLabel: string;
    if (/^[UW]/.test(recipient)) {
      const info = await readSlack(connectionId, `/users.info?user=${encodeURIComponent(recipient)}`);
      if (!info.user || info.user.deleted || info.user.is_bot || info.user.team_id !== identity.team_id) {
        throw new LktAccessError(400, "Pilih penerima manusia aktif dari workspace Slack yang terhubung.");
      }
      const dm = await readSlack(connectionId, "/conversations.open", { users: recipient });
      slackChannelId = dm.channel?.id ?? "";
      recipientLabel = `DM ${info.user.real_name || info.user.name || recipient}`;
    } else {
      const info = await readSlack(connectionId, `/conversations.info?channel=${encodeURIComponent(recipient)}`);
      if (!info.channel || info.channel.is_archived || info.channel.is_member === false) {
        throw new LktAccessError(400, "Pilih kanal aktif yang sudah diikuti akun Slack terhubung.");
      }
      // Do not allow arbitrary existing DMs: use a human user ID to resolve one.
      if (!/^[CG]/.test(recipient) || info.channel.is_im || info.channel.is_mpim) {
        throw new LktAccessError(400, "Gunakan ID kanal C/G, atau ID pengguna U/W untuk pesan langsung.");
      }
      recipientLabel = `#${info.channel.name || recipient} · seluruh anggota kanal`;
    }
    if (typeof slackChannelId !== "string" || !/^[CGD][A-Z0-9]{8,30}$/.test(slackChannelId)) throw new Error("Invalid Slack destination");
    return { connectionId, slackTeamId: identity.team_id, slackChannelId, recipientLabel: recipientLabel.slice(0, 200) };
  } catch (error) {
    if (error instanceof LktAccessError) throw error;
    throw new LktAccessError(503, "Koneksi Slack belum siap. Hubungkan integrasi yang disetujui; tidak ada pesan dikirim.");
  }
}

export async function sendSlackDigest(destination: SlackDestination, text: string, deliveryId: string, proxy = proxySlack): Promise<SendOutcome> {
  // Preflight failures are safe: chat.postMessage has not been called.
  try {
    const identity = await readSlack(destination.connectionId, "/auth.test", {}, proxy);
    if (identity.team_id !== destination.slackTeamId) return { status: "failed", detail: "Workspace Slack berubah. Konfigurasikan ulang tujuan." };
  } catch {
    return { status: "failed", detail: "Koneksi Slack tidak tersedia. Periksa izin dan konfigurasikan ulang tujuan." };
  }
  try {
    const response = await proxy("slack", "/chat.postMessage", {
      connectionId: destination.connectionId, signal: AbortSignal.timeout(15_000), method: "POST",
      headers: { "Content-Type": "application/json" },
      body: {
        channel: destination.slackChannelId, text, client_msg_id: deliveryId,
        mrkdwn: false, parse: "none", link_names: false, unfurl_links: false, unfurl_media: false,
      },
    });
    if (response.status === 429) {
      return { status: "retry", detail: "Batas Slack tercapai; percobaan ulang terjadwal.",
        retrySeconds: Math.max(60, Number(response.headers.get("retry-after")) || 60) };
    }
    // HTTP success alone is not a provider acknowledgement.
    const raw = await response.json();
    const data = slackData(raw);
    const acknowledgedChannel = (raw as { channel?: unknown }).channel;
    if (response.ok && data.ok === true && typeof data.ts === "string" && acknowledgedChannel === destination.slackChannelId) {
      return { status: "delivered", detail: null };
    }
    if (data.ok === false && typeof data.error === "string" && response.status < 500) {
      if (data.error === "ratelimited") return { status: "retry", detail: "Batas Slack tercapai.", retrySeconds: 60 };
      return { status: "failed", detail: "Slack menolak pesan. Periksa izin, tujuan, dan keanggotaan lalu konfigurasikan ulang." };
    }
    return { status: "uncertain", detail: "Penerimaan Slack tidak dapat dipastikan. Tidak dicoba ulang untuk mencegah duplikasi." };
  } catch {
    return { status: "uncertain", detail: "Koneksi terputus saat mengirim. Periksa Slack; tidak dicoba ulang otomatis." };
  }
}
