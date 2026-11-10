#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
bun scripts/prepare-assets.ts
node --input-type=module -e 'import net from "node:net"; for(const port of [3000,3210,3211]) { await new Promise((resolve,reject)=>{const s=net.createServer();s.once("error",()=>reject(new Error(`Port ${port} is already in use. Reuse or stop the existing project server.`)));s.listen(port,"127.0.0.1",()=>s.close(resolve));}); }'
CONVEX_AGENT_MODE=anonymous bunx convex dev --typecheck enable --tail-logs disable &
reader_convex_pid=$!
reader_next_pid=''
cleanup(){ if [ -n "$reader_next_pid" ]; then kill "$reader_next_pid" 2>/dev/null || true; fi; kill "$reader_convex_pid" 2>/dev/null || true; wait "$reader_convex_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for reader_attempt in $(seq 1 60); do
  if [ -f .env.local ] && curl --silent --fail http://127.0.0.1:3210/version >/dev/null; then break; fi
  kill -0 "$reader_convex_pid" 2>/dev/null || { echo 'Convex stopped before readiness.' >&2; exit 1; }
  sleep 1
done
curl --silent --fail http://127.0.0.1:3210/version >/dev/null || { echo 'Convex did not become ready in 60 seconds.' >&2; exit 1; }
bunx convex env set CLERK_JWT_ISSUER_DOMAIN ''
bunx convex env set ALLOW_LOCAL_AUTH true
APP_MODE=local LLM_PROVIDER="${LLM_PROVIDER:-mock}" bun run dev &
reader_next_pid=$!
wait "$reader_next_pid"
