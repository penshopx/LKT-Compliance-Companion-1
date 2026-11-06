# LKTara — Pendamping Laporan Keuangan Tahunan

Aplikasi berbahasa Indonesia untuk mendampingi perusahaan dalam persiapan LKT, memahami referensi, berkonsultasi dan menangani masalah akuntansi awal.

## Run & Operate

- Run through managed workflows `artifacts/api-server: API Server` and `artifacts/lkt-companion: web`; they supply service ports and routing.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
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
- `lib/db/src/schema/lkt-*.ts` — browser workspaces, consultation messages, activity.
- `docs/referensi-lkt.md` — 11 user-supplied web links and one academic PDF, with verification caveats.

## Architecture decisions

- First version deliberately avoids sensitive transaction/document ingestion and automatic report generation. **Why:** business type, accounting eligibility and detailed preparation scope were not confirmed.
- Browser-bound workspaces are a first-version convenience, not authenticated company accounts. **Why:** deliver a usable guidance prototype without claiming multi-user security. Add managed authentication and organization authorization before handling real sensitive business data.
- No automatic statutory deadlines or compliance certification. **Why:** user-provided links have not been read or legally verified; OJK and KJPP references have distinct scopes.
- AI receives reference metadata, not retrieved articles. **Why:** avoid pretending that article titles prove current legal requirements. Do not describe consultation as grounded RAG or real-time legal research.

## Product

- Ringkasan progres persiapan, checklist per tahun buku dengan status/catatan dan ekspor CSV.
- Profil nonpublik, UMKM, publik atau KJPP; pilihan standar tetap perlu konfirmasi profesional.
- Pustaka 12 sumber dengan pencarian dan simpan referensi; keberlakuan hukum belum diverifikasi. PDF akademik Dhyah Setyorini (2007) disajikan sebagai bacaan historis, bukan regulasi terkini.
- Enam panduan problem–solusi dan konsultasi AI OpenAI dengan riwayat serta penghapusan.
- Tidak menyusun neraca/laba rugi otomatis, tidak menyampaikan pajak atau laporan kepada regulator.

## User preferences

- Pengguna meminta aplikasi pendamping pembuatan LKT untuk perusahaan: regulasi, konsultasi dan problem–solusi.
- Seluruh 11 tautan yang diberikan pengguna menjadi referensi proyek.
- Pengguna meminta PDF Dhyah Setyorini (2007) ditambahkan sebagai referensi aplikasi; permintaan ini tidak mengubah video.

## Gotchas

- Bootstrap company query before other workspace queries, so parallel first-load requests do not create separate browser workspaces.
- Fiscal-year changes must refresh preparation progress; status/notes are year-scoped.
- Do not generalize OJK rules to nonpublic companies or PPPK KJPP rules to all companies.
- Annual report and financial report are different scopes; components depend on the confirmed accounting standard.
- AI usage uses Replit credits; 12 consultation attempts/hour/IP limit and one in-flight call/workspace.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Referensi LKT dari pengguna: [docs/referensi-lkt.md](docs/referensi-lkt.md). Isi dan keberlakuan sumber belum diverifikasi.
