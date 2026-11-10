# Independent review ledger

Scope: the complete new reader, using empty-tree base `4b825dc642cb6eb9a060e54bf8d69288fbee4904`. Stable diff command for the functionality rounds:

```sh
git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 -- . ':!artifacts' ':!bun.lock' ':!tests/fixtures/rag/2402.00838v4.json' ':!tests/fixtures/rag/2101.00027v1.json'
```

Before review:116 files,20603 added lines. Provider `codex`, model `gpt-6.1-sol`, reasoning effort `high`, service tier `priority`. Usage was not exposed. One reviewer per pass; no reviewer subagents. No scoped edits occurred while round1 ran. No push during the loop.

## Pass1: functionality, RAG correctness and security

Round1 on58d850c: **CHANGES**. Reviewer independently passed76 unit tests/221assertions and inspected the existing109-test/31-browser-test release evidence. No source/service changes by the reviewer.

| ID  | Severity             | Finding                                                                                   | Outcome / evidence                                                                                                                                                                                                                                                                               |
| --- | -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | blocker              | Local authorization used Next-normalized URL instead of incoming Host                     | Resolved in round2. Incoming loopback authority/port is required before local Convex client creation. Pure guard tests cover normalized URL and invalid authorities; browser regression checks the running Next boundary. Hosted same-origin writes use incoming Host.                           |
| S2  | should               | Re-saving an existing glossary term reset its review schedule                             | Resolved in round2. Preserve stored dueAt/interval/repetitions/createdAt when updating a duplicate definition. Real Convex save-review-save regression passes; UI resave regression added.                                                                                                       |
| A1  | should, parent audit | Related-paper action returned a definition instead of a cited work                        | Resolved in round3. Bibliography scope and exact-source mock extracts return actual cited titles or refuse. Real-PDF integration asserts a title and reference-page citations; browser assertion strengthened. Implicit scope also prefilters Convex vectors.                                    |
| A2  | should, parent audit | Summarize-section only proved an action parameter, not section scope                      | Resolved in round3. Infer the selected chunk section unless explicitly overridden; preserve whole-paper summaries. Real-PDF tests verify section-only evidence, explicit override and unscoped overview.                                                                                         |
| A3  | should, parent audit | Hosted account flow lacked root entry protection and account controls                     | Accepted in round2. Configured hosted mode requires a Clerk session, mounts sign-in/sign-up paths and account/sign-out controls. Missing keys show an accessible unavailable state and deny data; actual second local Next process and two viewport tests passed. Live Clerk remains unverified. |
| A4  | should, parent audit | Cross-paper collection sources reset the conversation; Explain inherited collection scope | Accepted in round2. Lift tab/scope state across reader changes; contextual actions target the current paper. Distinct-source browser regression verifies collection history, exact flash, saved page, and Explain isolation.                                                                     |
| A5  | should, parent audit | Resolving bibliography metadata unnecessarily invalidated paid contextual embeddings      | Accepted in round2. Fingerprint only actual indexed source inputs (ID/title/pages/outline). Real Convex provider-count regression proves metadata resolution reuses chunks and a changed source title still rebuilds.                                                                            |

Round2: **CHANGES**. S1/S2 resolved; A3/A4/A5 accepted. A1 remained open because the prose filter dropped short citation titles; A2 remained open because broad context could select an earlier section.

Round3 fixes: related work uses unfiltered bibliographic sentence boundaries, preserves short titles such as “Random forests.” and “BERT.”, and uses a longer original bibliography quotation when a title is shorter than the evidence minimum. The mock permits literal subsets only for original reference evidence; ordinary Q&A still requires exact extractive support. Section inference first matches selected text, uses context among matching candidates, and uses optional PDF selection rectangles to distinguish duplicated passages. Rectangles are bounded/validated and forwarded by the actual reader.

New regressions cover both short titles, a later Results selection with broad Methods/Results context, and identical same-page passages anchored to Results. All119 tests/559assertions across26files passed, as did formatting, lint, strict types, unchanged evaluation gates and production build. The affected assistant browser case passed with a positive rectangle assertion. The complete35-case browser rerun passed. Round3 returned **APPROVE**, independently confirming A1/A2 resolved with no new blocker or should findings. No findings declined and no pushes during the loop.

Historical cleanup:12 confirmed task-only collection chat rows from6 deleted test collections were physically removed through existing owned mutations; current workspace remains one15-page real paper,0collections/0glossary. Private export refreshed and ZIP-tested. No source edits occurred during any active review. Functionality review ended after three rounds; usage was not exposed. The approved source fixes were pushed in five separate commits (03289cb, f08d04f, 16d274b, 2951369, 700259f). The resulting functionality diff contains124files/21628added lines before the separate shadcn/UI pass.

## Pass2: UI/UX

Pending after functionality agreement. Includes desktop/tablet/mobile screenshot inspection and keyboard/focus/accessibility behavior, using the web-design-guidelines skill and its current primary-source rules. Live model language quality and real Clerk sign-in remain explicitly unverified without keys.
