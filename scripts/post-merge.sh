#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate:lkt-auth
pnpm --filter @workspace/db run migrate:lkt-consultation-snapshot
pnpm --filter @workspace/db run migrate:lkt-access-audit
pnpm --filter @workspace/db run migrate:lkt-editorial
pnpm --filter @workspace/db run migrate:lkt-reference-digests
pnpm run typecheck:libs
