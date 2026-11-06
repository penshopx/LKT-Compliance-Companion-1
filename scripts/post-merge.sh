#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate:lkt-auth
pnpm --filter @workspace/db run migrate:lkt-consultation-snapshot
pnpm run typecheck:libs
