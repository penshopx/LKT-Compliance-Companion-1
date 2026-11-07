---
name: Reference digest side-effect policy
description: Why scheduled external reminders fail closed and ambiguous delivery must not be replayed.
---

Scheduled reference reminders deliberately favor avoiding duplicate external messages over retrying every transient failure. A timeout or process interruption can occur after Slack accepted a message, so an unknown outcome requires owner inspection, not automatic replay. Integration approval is not recipient consent; configuring and activating a team destination is a separate explicit action.

**Why:** External send acknowledgement and database commit cannot be atomic, and a successful HTTP response is not proof of provider acceptance or legal verification. Retrying unknown outcomes may spam a team; silently changing recipients may disclose metadata without consent.

**How to apply:** Preserve opt-in defaults and explicit reconfiguration after identity changes. Keep reminder delivery independent of editorial findings and review schedules. When adding another provider, establish its real idempotency/acknowledgement guarantees before broadening retry behavior.

Session-level advisory locks must reuse their acquired database connection for all protected queries, including helpers and reference projection, while keeping delivery claims committed before external sends.

**Why:** Holding a pool slot for a lock and requesting another slot for ordinary queries can deadlock every caller when concurrent tenants fill the pool. Wrapping the external send in one database transaction instead would lose the durable claim on a crash.

**How to apply:** Pass the locked connection through all database helpers; use only short local transactions. Exercise distinct tenants concurrently at the actual pool limit when changing the worker or configuration flow.
