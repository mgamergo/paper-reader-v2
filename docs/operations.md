# Verify and preserve a local reader installation

Use these commands inside the project on the existing development box. The release scripts never start, stop, or replace an existing service. Keep one browser worker, and wait for other writers to finish before verification.

## Start local dependencies

1. Install the committed dependencies with `bun install --frozen-lockfile`.
2. Start local Convex in a dedicated shell.

   ```bash
   CONVEX_AGENT_MODE=anonymous bunx convex dev --typecheck disable --tail-logs disable
   ```

3. Wait for `http://127.0.0.1:3210/version` to respond successfully. Confirm `.env.local` points `NEXT_PUBLIC_CONVEX_URL` to that loopback origin.
4. Set the local authentication configuration explicitly on the local deployment.

   ```bash
   bunx convex env set CLERK_JWT_ISSUER_DOMAIN ''
   bunx convex env set ALLOW_LOCAL_AUTH true
   ```

Convex 1.49 rejects the deprecated `bunx convex dev --local` flag. Anonymous mode starts the supported local backend and requires no paid keys. The local configuration and backend database remain in ignored directories. Keep `ALLOW_LOCAL_AUTH` disabled for any shared or production deployment. Configure Clerk's issuer and its `convex` JWT template before using real authentication.

To develop with a server owned by one shell, use `bun run local` instead of starting duplicate services. Its port guard requires free ports 3000, 3210, and 3211.

## Run the release checks

1. Stop only your owned Next server. Leave the local Convex backend running.
2. Cache the actual public source used by browser source-import checks.

   ```bash
   bun scripts/cache-import-fixtures.ts .data/import-fixtures 1706.03762
   ```

3. Run the source phase. Set the real box instance ID when collecting evidence.

   ```bash
   BOX_INSTANCE_ID=0e09ad54-c2a4-4c19-8e9b-2d80fca789a4 bun scripts/verify-release.ts --phase source
   ```

   The phase runs formatting, lint, strict types, all unit and integration tests, the RAG evaluation, and a production build. A failed command stops the phase. Each subprocess has a five-minute deadline. The script refuses to build while Next is listening at the specified origin.

4. Start the verified production build in a dedicated shell.

   ```bash
   APP_MODE=local LLM_PROVIDER=mock IMPORT_FIXTURE_CACHE_DIR="$PWD/.data/import-fixtures" bun run start
   ```

5. Run the browser phase against that process.

   ```bash
   BOX_INSTANCE_ID=0e09ad54-c2a4-4c19-8e9b-2d80fca789a4 bun scripts/verify-release.ts --phase browser --base-url http://localhost:3000
   ```

   The phase checks the recorded build ID and application source fingerprint, then runs Playwright with one Chromium worker. It refuses sources changed since the source phase. Browser diagnostics come from the acceptance fixtures and include console errors, uncaught exceptions, failed requests, and HTTP errors.

6. Read the printed summary path under `.data/verification`. Inspect all affected desktop, tablet, and mobile screenshots. A successful script does not replace visual inspection.
7. Stop only the Next and Convex processes you started. Preserve the session box and its data for inspection.

Add `--plan` to either phase to print the commands without running checks or writing files. Pass `--base-url` to the source phase too if your owned Next process uses another loopback origin. The scripts reject public origins, URL credentials, and non-HTTP origins.

Each summary records the starting git SHA, application source SHA-256, build ID, box ID, command outcomes, durations, and log paths. Logs and summaries are private local files in ignored `.data`. The Playwright reporter also writes `artifacts/e2e-results.json`, and the evaluation refreshes its documented reports. Review those changes before committing. A documentation-only commit after testing changes the git SHA without changing the recorded application fingerprint.

The RAG mock is deterministic and extractive. Its checks do not establish real embedding quality, multilingual quality, or live Clerk sign-in. Add the provider and Clerk keys described in `.env.example`, then run a separate live acceptance session before those claims.

## Preserve the database and uploaded PDFs

1. Leave local Convex running. Confirm the loopback URL matches this project's `.convex/local/default/config.json`.
2. Preview the export command.

   ```bash
   bun scripts/backup-local.ts --plan
   ```

3. Export the local snapshot and file storage.

   ```bash
   BOX_INSTANCE_ID=0e09ad54-c2a4-4c19-8e9b-2d80fca789a4 bun scripts/backup-local.ts
   ```

4. Read the resulting `manifest.json`. Confirm its byte count, SHA-256, and `zipIntegrity: "passed"`.
5. Copy the entire timestamped directory under `.data/backups` to an authorized private durable location. Keep the archive private. It contains reader data and uploaded papers.

The script uses `bunx convex export --env-file <private-temporary-file> --include-file-storage`. It verifies the on-disk local deployment and loopback port, passes its URL/admin credential through a private temporary file, deletes that file in a `finally` block, and checks the ZIP with `unzip -tq`. The old `--deployment local` selector is not used because anonymous agent mode can misroute it to cloud authentication. It creates private directories and files, and excludes all backups from Git through `.data/`. It never copies `.env.local`, the local admin key, or the local configuration into the archive itself. Convex exports database content, so credentials entered into application content would still be exported.

Export integrity does not prove restoration. `restoreTested` remains false in the manifest. Test a future restoration in a separate disposable local installation, then compare table counts and uploaded PDF hashes before replacing a working database. No restore command runs during this session.

## Use the manual CI workflow

The workflow in `.github/workflows/verify.yml` runs only through `workflow_dispatch`. It has no push or pull-request trigger and uses no paid model keys. It starts an anonymous local Convex backend, uses original public arXiv bytes, builds the production app, and runs the same two verification phases. Its cleanup trap terminates only the process groups it started. Evidence expires after seven days.

This session performs all development and checks in the boxes.dev instance. The GitHub-hosted workflow is provided for a future explicitly initiated CI run and is not evidence of a CI run in this session. Do not add production secrets to its local-auth job.
