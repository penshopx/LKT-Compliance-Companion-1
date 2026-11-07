# LKTara — Pendamping Laporan Keuangan Tahunan

Aplikasi berbahasa Indonesia untuk mendampingi perusahaan dalam persiapan LKT, memahami referensi, berkonsultasi dan menangani masalah akuntansi awal.

## Run & Operate

- Run through managed workflows `artifacts/api-server: API Server` and `artifacts/lkt-companion: web`; they supply service ports and routing.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/api-server run test:references` — verify reference metadata, bounded statuses, citations and response round trips
- `pnpm --filter @workspace/api-server run test:evidence-archives` — archive/history hashes, preserved findings, append-only metadata and fail-closed downloads
- `pnpm --filter @workspace/db run migrate:lkt-evidence-archives` — additive archive attachment metadata; also runs after merge; never changes findings
- `pnpm --filter @workspace/api-server run evidence:archive list` / `audit` — operator targets and retained-history linkage audit; see `docs/referensi-lkt.md` for public-only archive ingestion
- `pnpm --filter @workspace/api-server run evidence:provision` — restore the committed initial metadata manifest from checksum-checked App Storage bytes; startup/post-merge also run it; see docs for authorized cross-bucket transfer
- `pnpm --filter @workspace/api-server run test:reference-digest` — isolated-schema schedule/authorization/deduplication/retry/unsubscribe checks and stubbed Slack acknowledgements; sends no real messages
- `pnpm --filter @workspace/db run migrate:lkt-reference-digests` — additive team digest preferences/delivery ledger; enables no subscriptions; also runs after merge
- `pnpm --filter @workspace/api-server run test:editorial` — isolated-schema integration checks for editorial authorization, full snapshots, conflicts, append-only protection and calendar dates; never writes fixture findings into the shared library
- `pnpm --filter @workspace/db run migrate:lkt-editorial` — additive global editorial roster/journal and append-only database trigger; grants no access; also runs after merge
- `pnpm --filter @workspace/api-server run test:consultation-snapshots` — verify snapshot versioning, POST persistence and reloaded legacy/changed warnings using isolated development fixtures and a stubbed AI provider
- `pnpm --filter @workspace/api-server run test:message-history` — verify cursor paging over 205+ messages, timestamp precision, tenant boundaries, snapshot warnings and duplicate-free reloads using isolated development fixtures
- `pnpm --filter @workspace/api-server run test:auth` — development-DB integration tests for tenant isolation, membership revocation, legacy migration, quotas and deletion; cleans up only its own fixtures
- `pnpm --filter @workspace/db run migrate:lkt-auth` — additive account migration, repeatable without claiming/deleting legacy data; also runs after task merge
- `pnpm --filter @workspace/db run migrate:lkt-consultation-snapshot` — additive nullable snapshot column; no backfill or rewrite of existing consultation history; also runs after task merge
- `pnpm --filter @workspace/db run migrate:lkt-access-audit` — additive access audit table; also runs after task merge
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: generated Zod schemas, `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/lkt-companion/` — web frontend at `/`.
- `artifacts/api-server/src/routes/lkt*.ts` — profile, checklist, reference, consultation APIs.
- `artifacts/api-server/src/lib/lkt-content.ts` — editorial preparation guidance and supplied references.
- `lib/api-spec/openapi.yaml` — API contract; regenerate hooks after changes.
- `lib/db/src/schema/lkt-*.ts` — companies, memberships, workspaces, consultation messages, activity and durable AI limits.
- `docs/referensi-lkt.md` — 13 user-supplied web links and one academic PDF, plus primary supporting sources and review caveats.

## Architecture decisions

- First version deliberately avoids sensitive transaction/document ingestion and automatic report generation. **Why:** business type, accounting eligibility and detailed preparation scope were not confirmed.
- Clerk manages login; company membership and owner/member authorization live in the application DB. Company selectors are not credentials. Every private API requires a verified Clerk session and current membership. **Why:** managed login alone does not provide company isolation.
- Legacy browser rows remain quarantined until the signed-cookie holder explicitly attests ownership while creating a NEW company. No preview or automatic migration into an existing/shared company. **Why:** legacy data has no authenticated owner; cookie possession cannot prove the original human's identity. On shared devices, do not claim data unless ownership is known. Lost-cookie recovery requires independent verification and is not offered by the app.
- Company deletion is owner-only and cascades profile/checklist/bookmarks/activity/messages/memberships; no app-side undo. AI data sent to the provider is not recalled by deleting local history. **Why:** deletion must accurately describe its scope.
- Access audit records only successful membership changes (not no-ops), transactionally with the change. Owner-only company audit and account-private deletion receipts expire after 90 days; reads hide expired rows immediately and startup/hourly cleanup removes them while the API is running. Company deletion cascades membership audit; its receipt keeps only actor/action/time/expiry and a random receipt ID, never a company identifier or content. **Why:** accountability must not recreate deleted company data.
- No automatic statutory deadlines or compliance certification. **Why:** reference reviews are bounded findings, not an exhaustive legal opinion; OJK and KJPP references have distinct scopes and periods.
- AI receives reference metadata, not retrieved articles. **Why:** avoid pretending that article titles prove current legal requirements. Do not describe consultation as grounded RAG or real-time legal research.

## Product

- Ringkasan progres persiapan, checklist per tahun buku dengan status/catatan dan ekspor CSV.
- Profil nonpublik, UMKM, publik atau KJPP; pilihan standar tetap perlu konfirmasi profesional.
- Pustaka mempertahankan 11 sumber awal beserta sumber primer pelengkap, dengan pencarian, simpan, filter cakupan/status, tanggal, periode dan bukti peninjauan. Artikel dibaca tidak berarti menjadi dasar hukum primer; rujukan DJP masih memerlukan telaah naskah perubahan.
- PDF akademik Dhyah Setyorini (2007) dari proyek utama tetap disajikan sebagai bacaan historis, bukan regulasi terkini; ringkasannya merujuk abstrak, bukan penelaahan hukum.
- Enam panduan problem–solusi dan konsultasi AI OpenAI dengan riwayat serta penghapusan.
- Tidak menyusun neraca/laba rugi otomatis, tidak menyampaikan pajak atau laporan kepada regulator.

## Editorial operations

- `/redaksi` is an account-only workspace, available without joining or selecting a company; `/referensi` links to it. Owner/member company roles never grant editorial authority.
- Editorial access is provisioned by a trusted operator, not by company owners. First independently verify the human and the target environment, and have them register/verify their email in that environment. Then run:
  `pnpm --filter @workspace/api-server run editorial:member grant '<verified-email>' '<human-display-name>' --confirm-identity`
  Use `revoke` instead of `grant` to remove access. The command resolves the verified email against the current environment's Clerk instance, creates no account and grants no company membership. Do not copy development user IDs to Production. Provisioning is deliberately manual and is NOT run automatically after merge.
- Redaksi can select an active human editor, reschedule, or append a complete findings snapshot with evidence and verification limits. No edit/delete API exists for journal events; database triggers reject update, delete and truncate. Corrections are new snapshots. Recorded author/name/time come from the server. Historical attribution survives revocation.
- Curated public evidence bytes live in App Storage, with append-only attachments to exact snapshot/evidence hashes. Capture time is distinct from the historical review day. Archiving never rewrites findings or proves unchanged past content. Operator-only ingestion, public ID-based checksum-checked download; no account-page, cookie, signed-CDN-URL or licensed-standard archiving.
- Baseline code findings and previous code-reviewed events remain retained history. Runtime entries are stored separately in PostgreSQL and projected consistently into library/bookmark responses and new AI consultation context.
- Scheduling alone retains the last findings/status/review day; calendar reminders use Asia/Jakarta and only become overdue after the scheduled day. Findings carry complete evidence, scope, period and verification limits; a secondary source cannot become primary-verified.
- Concurrent edits require a matching revision; a stale form must be reloaded/reviewed, never silently overwrite another editor. No AHU verification or automatic legal deadline calculation is performed by this workspace.

## User preferences

- Pengguna meminta aplikasi pendamping pembuatan LKT untuk perusahaan: regulasi, konsultasi dan problem–solusi.
- Seluruh 11 tautan yang diberikan pengguna menjadi referensi proyek.
- Pengguna meminta PDF Dhyah Setyorini (2007) ditambahkan sebagai referensi aplikasi; permintaan ini tidak mengubah video.

## Scheduled reference digests

- Referensi has an owner-only opt-in Slack schedule per company. Members can read its state/history, not change the destination or unsubscribe the team. The authorized Slack API integration uses the connectors SDK; no tokens are handled by application code. Exactly one connected Slack account must be available at configuration time, and its connection/workspace identity is pinned to the subscription.
- Owners supply a channel ID (all channel members receive the digest) or human Slack user ID (DM). Saving validates access and may open the DM, but sends no test message. No schedule is enabled by migration, integration attachment, or merely opening the page. A disconnected/changed integration fails closed. Replacing it requires explicit owner reconfiguration.
- Daily/weekly slots use Asia/Jakarta (UTC+7), strictly after activation. The API polls once per minute **while its process is running**. Run this service continuously for dependable unattended schedules; an idle/stopped/sleeping server cannot deliver, and previous calendar days are never replayed on restart. No deployment or infrastructure settings are changed by this feature.
- A durable unique company/WIB-day ledger plus a cross-process advisory lock prevents edits, concurrency, and restarts from resending a daily digest. No personal company data is sent: only current shared reference metadata, capped at 20 entries, for due/overdue, needs-review, or outdated items. Empty digests do not post.
- Claims are committed before Slack is called. A provider `ok: true` plus message/channel acknowledgement means delivered; HTTP 200 alone does not. Only explicit rate-limit rejection retries, at most three attempts within the same WIB day with the original payload/id. Timeouts, malformed acknowledgements, and interrupted claims are uncertain and never retried automatically; failed/uncertain outcomes pause the subscription for owner inspection. This deliberately favors avoiding duplicate external messages over guaranteed delivery after an ambiguous failure.
- Unsubscribe via Referensi > Ringkasan terjadwal stops future sends and cancels retries. If a send holds the lock, the stop request returns an explicit busy error; retry after it finishes. A successful stop never recalls an already delivered Slack message. Revocation of the authorizing owner's company role pauses future sends.
- Schedule changes and successful messages **never** write to verification findings, review dates, next-review dates, or the editorial journal. Last 20 delivery records are shown per company; deleting a company cascades its digest preferences/history.

## Access-change notifications

- Tim & akun offers an independent owner-only opt-in Slack destination for future member grants/revocations. A channel discloses metadata to all its members; a user ID resolves to a DM. Consent names the exact metadata: company name, change type and timestamp, never actor/target IDs, email or report/consultation content. Configuration validates Slack without sending a test message.
- Membership changes, audit and outbox enqueue commit together under the company row lock. A delivery is keyed by its audit event, and only real changes enqueue. No external send happens inside the mutation transaction. A separate worker polls every 10 seconds while the API runs; no email or reference-digest subscription is enabled by this feature.
- Delivery claims commit before contacting Slack. Failed, rate-limited, ambiguous and interrupted claims are terminal and never automatically replayed; the owner sees recent delivery statuses. This favors avoiding duplicates over guaranteed delivery. Changing settings or stopping cancels pending events, not already-sent Slack messages.
- A dedicated session advisory lock serializes access-notification sending, settings and company deletion. If delivery is active, deletion/stop returns a busy error and must be retried. A successful company deletion cascades all notification preferences and queue/history identifiers; it never recalls posted Slack messages. Delivery history also follows audit retention.

## Gotchas

- Keep all private frontend state and query clients isolated by Clerk user AND company; switch company with a per-request header, never a shared active-company cookie. Remount forms on switches and discard previous-account state.
- Fiscal-year changes must refresh preparation progress; status/notes are year-scoped.
- Do not generalize OJK rules to nonpublic companies or PPPK KJPP rules to all companies.
- Annual report and financial report are different scopes; components depend on the confirmed accounting standard.
- AI usage uses Replit credits; durable limits are 12 attempts/hour/account across companies and 36/hour/company across members. One in-flight call/company uses a database lease; restarts do not reset quotas.
- Development and Production use separate Clerk accounts. Do not seed production membership with development user IDs.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Referensi LKT dan batas temuan peninjauan: [docs/referensi-lkt.md](docs/referensi-lkt.md). Jangan mengubah status menjadi terverifikasi hanya karena URL dapat diakses.
