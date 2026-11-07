---
name: Consultation snapshot policy
description: What an AI answer's reference snapshot proves and how to preserve its meaning.
---

Version the editorial metadata actually supplied to the AI, not reminder-clock or bookmark state. Compare the entire supplied library conservatively: a change can affect an answer even if that source is not explicitly cited. A matching version means only that the application's notes are unchanged, never that the answer is correct, legally current, or based on live web research.

**Why:** Consultation receives editorial notes rather than retrieved source documents, and there is no reliable per-answer citation trace. Claiming a narrower dependency set would give false confidence.

**How to apply:** Keep the prompt's reference projection and version calculation aligned when adding evidence fields. Do not backfill snapshots onto historical answers; missing provenance must remain visibly unknown. Recompute freshness on reads without rewriting message content or saved snapshots.

For reusing historical questions, prefer an unavailable action over guessing when chronological pairing is ambiguous. Keep question reuse separate from sending a new consultation.

**Why:** Legacy history has no stored reply link. Choosing a nearby question can silently ask about a different issue, and copying a question must not imply that an old answer has been refreshed.

**How to apply:** Resolve the immediate pair on the server across page boundaries, never search past another assistant, and keep the normal authorization and usage checks on the eventual send. Search filters must not redefine adjacency: resolve provenance against the full history even when the original question does not match the search.

An explicit reconsultation relationship records the user's starting answer, not a claim that the new answer is more correct. A user may edit the reused question or change focus while retaining that relationship; show the actual questions and focuses for comparison. Never infer these relationships for legacy answers.

**Why:** Copying an old question and producing another answer must not silently rewrite history or imply renewed legal verification.

**How to apply:** Preserve each answer's original snapshot and content, keep sending separate from filling a draft, and require the same company membership and consultation quota checks for linked and ordinary questions.
