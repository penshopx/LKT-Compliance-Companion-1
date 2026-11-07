#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate:lkt-auth
pnpm --filter @workspace/db run migrate:lkt-consultation-snapshot
pnpm --filter @workspace/db run migrate:lkt-consultation-specialists
pnpm --filter @workspace/db run migrate:lkt-access-audit
pnpm --filter @workspace/db run migrate:lkt-access-notifications
pnpm --filter @workspace/db run migrate:lkt-editorial
pnpm --filter @workspace/db run migrate:lkt-operators
pnpm --filter @workspace/db run migrate:lkt-evidence-archives
pnpm --filter @workspace/db run migrate:lkt-reference-digests
pnpm --filter @workspace/db run migrate:lkt-report-cycles
pnpm --filter @workspace/db run migrate:lkt-report-findings
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run evidence:provision
