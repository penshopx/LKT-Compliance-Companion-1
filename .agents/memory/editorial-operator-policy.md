---
name: Editorial operator authority
description: Independent infrastructure-provisioned authority and honest access audit provenance.
---

Operator authority must be explicitly provisioned by trusted infrastructure administration, independently from editor and company roles. Do not automatically seed an operator on startup or confer editor rights with an operator grant. Keep operator provisioning off HTTP.

**Why:** The shared reference library affects all companies; the user explicitly requires separate operator authorization and prohibits first-account privilege bootstrap.

**How to apply:** Preserve the explicit human/environment confirmation flow for bootstrap and recovery. Audit actual access transitions atomically, distinguish CLI administrator-declared names from authenticated panel actors, and never fabricate audits for legacy grants. Revocation retains historical journal attribution.
