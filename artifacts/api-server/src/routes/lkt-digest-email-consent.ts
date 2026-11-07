import { Router, type IRouter, type Response } from "express";
import { UpdateDigestEmailConsentBody, ViewDigestEmailConsentQueryParams } from "@workspace/api-zod";
import { readDigestEmailConsent, updateDigestEmailConsent } from "../lib/lkt-reference-digest";
import { LktAccessError } from "../lib/lkt-ai-limits";

const router: IRouter = Router();
const escape = (value: string) => value.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
function page(res: Response, body: string, status = 200) {
  res.status(status).set({
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
  }).type("html").send(`<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Persetujuan email — LKTara</title><style>body{background:#0b1220;color:#edf4ff;font:16px/1.6 system-ui;margin:0;padding:24px}main{max-width:640px;margin:40px auto}button{font:inherit;background:#b9dfff;color:#0b1220;border:0;border-radius:8px;padding:12px;margin:8px 8px 8px 0;cursor:pointer}p{overflow-wrap:anywhere}</style><main><h1>Ringkasan email LKTara</h1>${body}</main></html>`);
}
function failure(res: Response, error: unknown) {
  if (!(error instanceof LktAccessError)) throw error;
  page(res, `<p>${escape(error.message)}</p>`, error.status);
}
router.get("/lkt/digest-email-consent", async (req, res): Promise<void> => {
  const parsed = ViewDigestEmailConsentQueryParams.safeParse(req.query);
  if (!parsed.success) { page(res, "<p>Tautan tidak berlaku.</p>", 400); return; }
  try {
    const config = await readDigestEmailConsent(parsed.data.token);
    const topics = { all: "Seluruh pustaka", tax: "Perpajakan", capital_market: "Pasar modal", accounting_standards: "Standar akuntansi" };
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    page(res, `<p>Penerima: <b>${escape(config.recipient)}</b><br>Pengirim: ${escape(config.sender ?? "")}<br>Jadwal: ${config.cadence === "daily" ? "Harian" : `Setiap ${days[config.weekday]}`} pukul ${escape(config.timeWib)} WIB<br>Topik: ${topics[config.topic]}</p>
      <p>Hanya metadata pustaka bersama; tidak ada profil, catatan, atau percakapan perusahaan. Ini pengingat editorial, bukan verifikasi hukum atau jaminan kepatuhan. Jadwal bekerja selama server berjalan.</p>
      <p>Membuka tautan tidak mengubah langganan. Tautan ini bersifat pribadi; jangan teruskan kepada orang lain. Persetujuan ditujukan hanya untuk penerima di atas. ${config.confirmed ? "Persetujuan sudah dicatat; tautan ini tidak dapat mengaktifkan ulang jadwal." : "Pengiriman tetap nonaktif sampai Anda menyetujui. Jangan setujui jika Anda bukan penerima yang dimaksud."}</p>
      <form method="post" action="/api/lkt/digest-email-consent"><input type="hidden" name="token" value="${escape(parsed.data.token)}">
      ${config.confirmed ? "" : '<button name="action" value="confirm">Saya penerima dan menyetujui langganan</button>'}
      <button name="action" value="unsubscribe">Berhenti berlangganan</button></form>
      <p>Berhenti berlangganan membatalkan pengiriman berikutnya, bukan menarik email yang telah dikirim. Jika pengiriman sedang berjalan, coba lagi setelah selesai. Tidak perlu akun LKTara.</p>`);
  } catch (error) { failure(res, error); }
});
router.post("/lkt/digest-email-consent", async (req, res): Promise<void> => {
  const parsed = UpdateDigestEmailConsentBody.strict().safeParse(req.body);
  if (!parsed.success) { page(res, "<p>Permintaan tidak valid.</p>", 400); return; }
  try {
    await updateDigestEmailConsent(parsed.data.token, parsed.data.action);
    page(res, parsed.data.action === "confirm"
      ? "<p>Persetujuan tersimpan. Pengiriman dimulai pada jadwal berikutnya, tanpa email uji. Anda dapat memakai tautan yang sama untuk berhenti berlangganan.</p>"
      : "<p>Langganan dihentikan. Pengiriman berikutnya dan percobaan ulang dibatalkan. Email yang sudah dikirim tidak ditarik kembali.</p>");
  } catch (error) { failure(res, error); }
});
export default router;
