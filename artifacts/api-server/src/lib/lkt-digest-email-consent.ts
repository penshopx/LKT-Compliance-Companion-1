import { createHmac, timingSafeEqual } from "node:crypto";
import { LktAccessError } from "./lkt-ai-limits";

function signature(nonce: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new LktAccessError(503, "Penandatangan tautan persetujuan belum tersedia.");
  return createHmac("sha256", secret).update(`lkt-digest-email:${nonce}`).digest("hex");
}

export function digestConsentToken(nonce: string): string {
  return `${nonce}.${signature(nonce)}`;
}

export function verifiedDigestNonce(token: string): string {
  if (!/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(token)) throw new LktAccessError(400, "Tautan tidak berlaku.");
  const [nonce, mac] = token.split(".");
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(nonce), "hex"))) {
    throw new LktAccessError(400, "Tautan tidak berlaku.");
  }
  return nonce;
}

export function digestConsentUrl(nonce: string): string {
  // Runtime routing domains belong to this environment, not a production URL
  // guessed from the project name. Operators may pin a canonical public origin.
  const origin = process.env.DIGEST_PUBLIC_ORIGIN
    ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}` : "");
  let url: URL;
  try { url = new URL(origin); } catch { throw new LktAccessError(503, "Alamat publik aplikasi belum tersedia untuk tautan penerima."); }
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new LktAccessError(503, "Alamat publik aplikasi harus origin HTTPS.");
  }
  return `${url.origin}/api/lkt/digest-email-consent?token=${digestConsentToken(nonce)}`;
}
