import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, test } from "node:test";

import { getJson, REGISTRY_TIMEOUT_MS } from "../src/api.js";

let server: Server;
let base: string;

beforeEach(async () => {
  // A server that accepts the connection but NEVER responds — simulates a slow
  // registry that would otherwise hang the CLI forever.
  server = createServer(() => {
    /* intentionally never call res.end() */
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("default registry timeout is within 20-30s", () => {
  assert.ok(REGISTRY_TIMEOUT_MS >= 20_000 && REGISTRY_TIMEOUT_MS <= 30_000);
});

test("getJson aborts a never-responding registry with a clear 'timed out' error", async () => {
  await assert.rejects(
    // 100ms timeout against the hanging server: the AbortController must fire.
    () => getJson(`${base}/hang`, 100),
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      assert.match(msg, /timed out after/i);
      assert.match(msg, /Is it reachable\?/);
      return true;
    },
  );
});
