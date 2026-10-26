#!/usr/bin/env node
// Deletes rooms with no activity for ROOM_MAX_IDLE_HOURS (5 h) — with their
// events and results — and prints how many were deleted. Meant to run every
// hour from a scheduler, with the environment from Varlock:
//
//   varlock run -- node scripts/cleanup-inactive-rooms.mjs
//
// `--dry-run` only prints how many would be deleted. Needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (the SQL function is callable by the service
// role only). Exit code 1 on any error.
import { createClient } from "@supabase/supabase-js";

import {
  cleanupInactiveRooms,
  ROOM_MAX_IDLE_HOURS,
} from "../app/models/room-cleanup.js";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "cleanup-inactive-rooms: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (run it with `varlock run --`)",
  );
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const count = await cleanupInactiveRooms(client, { dryRun });
  console.log(
    `cleanup-inactive-rooms: ${dryRun ? "would delete" : "deleted"} ${count} room(s) inactive for ${ROOM_MAX_IDLE_HOURS} h`,
  );
} catch (error) {
  console.error(
    "cleanup-inactive-rooms: failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
