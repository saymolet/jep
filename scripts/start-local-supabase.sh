#!/usr/bin/env bash

set -euo pipefail

# The app's required local keys come from `supabase status`, so they do not
# exist until the stack is running. Only load the optional auth-provider values
# that Supabase needs while bootstrapping the stack. Storage stays enabled:
# imported SIGame packs upload their media to the "game-media" bucket.
exec pnpm exec varlock run --filter "SUPABASE_AUTH_*" -- \
  pnpm exec supabase start \
  -x imgproxy,edge-runtime,logflare,supavisor,vector
