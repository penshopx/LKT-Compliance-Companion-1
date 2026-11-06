#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run migrate:lkt-auth
pnpm run typecheck:libs
