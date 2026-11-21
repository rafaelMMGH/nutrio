# Feature metrics

One row per feature when it reaches `implemented` (the orchestrator appends it). The bug fix route adds 1 to
"Defects after merge" when a root cause lies in an implemented feature.

- **Elapsed h:** first to last commit on the feature branch (`git log`).
- **Tokens:** pasted by the user from their usage view; blank if skipped.
- **Verify / Review rounds:** loop rounds counted in the session.

| Feature | Lane | REQs | Implemented | Elapsed h | Tokens | Verify rounds | Review rounds | Defects after merge |
|---|---|---|---|---|---|---|---|---|
