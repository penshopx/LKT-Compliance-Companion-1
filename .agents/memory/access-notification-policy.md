---
name: Access notification safety
description: Why access-change delivery is separate from scheduled digests and serialized with company deletion.
---

Access-change notifications require their own explicit owner consent, independent of scheduled reference digests. All external outcomes, including explicit rate limits, are terminal for access-change messages; unknown delivery must never be automatically replayed.

**Why:** Repeated access mutation requests and interrupted external sends must not duplicate notifications. A scheduled shared-reference subscription does not authorize disclosure of company metadata.

**How to apply:** Preserve atomic membership/audit/outbox writes, commit delivery claims before sending, and coordinate company deletion and notification settings with the same delivery session lock. A successful company deletion must remove queued identifiers and prevent later sends. Use the locked database connection throughout to avoid pool starvation.
