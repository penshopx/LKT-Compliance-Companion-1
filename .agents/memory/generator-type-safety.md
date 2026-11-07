---
name: Generator type safety
description: Why API generator configuration belongs in the workspace typecheck gate.
---

Keep API generator configuration under type checking even when code generation itself succeeds.

**Why:** Orval can load a TypeScript configuration without checking its types, leaving obsolete options unnoticed after an upgrade. The installed generator's typed configuration exposed legacy formatting options that code generation alone had not rejected.

**How to apply:** When upgrading the generator or editing its configuration, preserve its inclusion in the root typecheck and use options supported by the installed version. Do not hide mismatches with casts or suppressions.
