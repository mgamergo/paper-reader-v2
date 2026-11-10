# Release verification

Verification is in progress on boxes.dev instance `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`, repository `/home/boxes/repos/paper-reader-v2`, branch `dev`. No old project was reused. This document will record the final source/build identity, browser results, screenshot inspection and independent review ledger.

The first acceptance worker reported 15/19 and found concrete defects; that historical frozen build is described in `browser-acceptance.md`. Parent fixes and twelve extended cases have passed focused runs. A single complete release run is required before claiming final acceptance.

All paid-model behavior uses a clearly labeled deterministic mock. The one manual Hindi UI fixture verifies presentation/citation/glossary bindings and is never counted as generated multilingual quality. Deliberate invalid-import HTTP400 responses and their exact Chromium resource-error console messages are allowed only by URL/status declarations in those specific tests. All other diagnostics remain failures.

## Verified application snapshot before independent review

Application SHA `d7d04bb` (full SHA and source hash in the JSON reports), box `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`: formatting, lint, strict TypeScript, 109 tests/495 assertions across23 files, all retrieval judgments/ablations and production build passed. All31 Playwright cases passed with zero failed/skipped/flaky tests, one Chromium worker, against the same recorded build. Exact commands and build fingerprint: `artifacts/release-source-verification.json` and `artifacts/release-browser-verification.json`.

Desktop1440×900, tablet768×1024 and mobile390×844 screenshots were captured and inspected for overflow, clipping, controls and dialogs. Highlights are checked geometrically after zoom and rotation. Actual published-paper PDFs and authored verification PDFs are distinguished; no synthetic paper is presented as a published study. See `artifacts/acceptance-*.png`.

The independent functionality/security and UI/UX sol-loop passes remain pending. Documentation/report-only commits after this snapshot do not change the tested application fingerprint; behavior changes require new checks.
