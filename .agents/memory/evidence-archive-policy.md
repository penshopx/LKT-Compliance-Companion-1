---
name: Public evidence archive provenance
description: Preservation and provenance boundaries for historical regulatory evidence copies.
---

Attach archive copies to exact historical findings separately; do not rewrite journal snapshots to add an archive. Distinguish original review day from later capture time, and never imply a later copy proves what the source contained at the earlier review.

**Why:** The request is to keep public primary evidence auditable if AHU removes or changes a publication, without changing the original source or automatically promoting verification.

**How to apply:** Preserve only relevant public excerpts/images with original canonical URLs, checksums and explicit scope limitations. Caption-only archives must not be described as complete carousels. Never retain signed CDN URLs, cookies, account data or licensed standards. Archive attachments are presentation/provenance, not new findings or new AI knowledge.

An archive feature must carry a repeatable metadata restoration manifest/procedure, not only objects ingested into the current development database. Restore from already preserved bytes, never reconstruct a supposedly historical copy by fetching the live source again.

**Why:** Database migrations create empty tables; a new database or different App Storage bucket would otherwise lose the links despite successful local ingestion.

**How to apply:** Provision and validate in the target environment under operator access. Fail explicitly on missing/corrupt byte payloads or historical linkage conflicts. Do not claim development-only ingestion provisions production.
