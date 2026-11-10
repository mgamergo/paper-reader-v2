# Release verification

Verification runs inside boxes.dev instance `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`, repository `/home/boxes/repos/paper-reader-v2`, branch `dev`. No previous reader project was reused.

## Reviewed application snapshot

Starting commit `6754de5719a7bc89a9ffd01814e74914acd56bba` plus the uncommitted UI review fixes passed formatting, lint, strict TypeScript,120tests/563assertions, every unchanged real-paper judgment/ablation and production build. Actual application fingerprint `e05253e6084e7e64198890d6b0a74c0558f0d1ccbc3033b00e0f7c779b35adff`, build `23_LMZ8fP22y4dW-9a3Bp`. JSON reports retain the true starting SHA and source fingerprint. Final clean-SHA verification follows review agreement.

All37Playwright cases pass with0failed/skipped/flaky cases, one Chromium worker and matching build. New regressions type tags character by character, verify canceled deletions preserve database rows, require search/note/chat passages inside the PDF viewport at150–300%zoom, and assert mobile/tablet drawer focus containment/restoration and Import handoff. Initial focused3/5failures were fixed without changing the question or weakening assertions; focused5/5and the complete37/37rerun pass.

A separate visual probe captured deletion confirmation and tablet/mobile drawers, checked focus and cancellation, reported zero unexpected diagnostics, deleted its temporary bookmark and restored reading progress. Source/build stayed unchanged. Reports: `artifacts/release-source-verification.json`, `artifacts/release-browser-verification.json`; screenshots `artifacts/acceptance-*.png`.

Diagnostics attach before navigation: console, page exceptions, failed requests and HTTP errors. Only exact declared invalid-import HTTP400/resource-console pairs are expected. The original worker15/19run is historical; its failures are covered by later regressions. Manual Hindi fixtures prove presentation/citation/glossary bindings only. Real Clerk, learned retrieval and generated multilingual quality remain unverified without keys.

Functionality/security/RAG review approved after three rounds. UI/UX round1 found U1–U4; all are implemented and regression-tested, approved in round2. See `docs/sol-loop.md`.

All reviewed source fixes are committed and pushed through d002d5d. The next release run starts from a clean committed repository and records its true starting SHA. Any later evidence/report-only commit will be identified separately; no untested application change is permitted.
