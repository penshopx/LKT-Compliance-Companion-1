---
name: Calendar-only dates in API contracts
description: Avoid unintended timestamp conversion for editorial review dates in generated contracts.
---

For calendar-only editorial review dates, preserve an ISO `YYYY-MM-DD` string end to end instead of using a timestamp.

**Why:** In this project's OpenAPI generation, `format: date` produced a server-side `Date` type while the frontend consumed a string. Date coercion also risks serializing the review day as a timestamp, implying time-zone precision that editorial review does not have.

**How to apply:** Use a constrained string for review days, regenerate both clients and validators, and check response round trips preserve the date exactly. Continue using real timestamps where an event's time matters.

For calendar-day searches over access-audit timestamps, interpret both inclusive dates in WIB (Asia/Jakarta), not the viewer's browser time zone.

**Why:** Audit times are displayed in WIB. Filtering by a different time zone would exclude events users see on the selected day, especially around midnight.

**How to apply:** Keep request days as validated calendar strings and convert to an inclusive WIB start and exclusive following-day boundary only at the database-query boundary.
