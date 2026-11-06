---
name: Safe account schema migration
description: Why account schema changes use additive SQL instead of forcing a Drizzle push.
---

Do not accept truncation suggestions when adding organization ownership to existing browser data.

**Why:** Drizzle's noninteractive push offered to truncate the populated workspace table when adding a nullable unique organization column, even though multiple NULL values are safe in PostgreSQL. Forcing that prompt risks deleting the legacy data the migration must preserve.

**How to apply:** Use a reviewed additive transaction for this transition. Leave unclaimed legacy rows untouched; never use a destructive push as a shortcut past an interactive migration prompt.
