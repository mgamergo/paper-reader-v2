# Release verification

Verification runs inside boxes.dev instance `0e09ad54-c2a4-4c19-8e9b-2d80fca789a4`, repository `/home/boxes/repos/paper-reader-v2`, branch `dev`. No previous reader project was reused.

## Current pre-UX review snapshot

Starting commit `700259f28381da670072f4bd1c9bd47e089bb9e2` plus the shadcn Button/config integration passed formatting, lint, strict TypeScript,119tests/559assertions, every fixed real-paper retrieval judgment/ablation, and production build. Application source fingerprint `ff84880b4f0c567857d7fbd5a8f8d52e3de1c36dced03cdaf53365dd103f3ead`, build `ozyHqafgvciYio2xE1RZZ`. Both verification JSON files retain their actual starting SHA rather than relabeling uncommitted changes as a clean commit. A final clean-SHA run follows independent UI review.

All35Playwright cases passed with0failed/skipped/flaky cases, one Chromium worker, against that matching production build. Browser listeners attach before navigation for console errors, page errors, failed requests and HTTP4xx/5xx. Only declared invalid-import HTTP400 responses and their exact resource console message are expected; all other diagnostics fail. Commands and logs are in `artifacts/release-source-verification.json` and `artifacts/release-browser-verification.json`.

Screenshots cover desktop1440×900, tablet768×1024 and mobile390×844, actual published PDFs, authored verification PDFs, dialogs and manual Hindi protocol bindings. Highlights are checked geometrically after zoom/rotation. Chromium viewport checks do not establish other engines or real-device support.

Functionality/security/RAG sol-loop approved after three rounds; see `docs/sol-loop.md`. UI/UX review is next. Real Clerk sessions, learned semantic retrieval and generated multilingual quality remain unverified without keys. The manual Hindi fixture proves presentation and citation/glossary bindings only.

The original acceptance worker's15/19 historical run is preserved in `browser-acceptance.md`; its four failures were fixed and covered by the current suite. Earlier proof remains historical, not evidence for later changes.
