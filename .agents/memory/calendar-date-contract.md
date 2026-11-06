---
name: Calendar-only dates in API contracts
description: Avoid unintended timestamp conversion for editorial review dates in generated contracts.
---

For calendar-only editorial review dates, preserve an ISO `YYYY-MM-DD` string end to end instead of using a timestamp.

**Why:** In this project's OpenAPI generation, `format: date` produced a server-side `Date` type while the frontend consumed a string. Date coercion also risks serializing the review day as a timestamp, implying time-zone precision that editorial review does not have.

**How to apply:** Use a constrained string for review days, regenerate both clients and validators, and check response round trips preserve the date exactly. Continue using real timestamps where an event's time matters.
