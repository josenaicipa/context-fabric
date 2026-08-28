import test from "node:test";
import assert from "node:assert/strict";
import { ConfigError, Fabric, validateConfig } from "../src/index.js";

test("validateConfig accepts a minimal valid document", () => {
  const config = validateConfig({
    version: 1,
    routing: [{ project: "acme-shop", channel: "#acme-shop", boost: 2 }],
    budget: { maxTokens: 4000, reserveTokens: 500 },
  });
  assert.equal(config.version, 1);
  assert.equal(config.routing?.[0]?.project, "acme-shop");
  assert.equal(config.budget?.maxTokens, 4000);
});

test("validateConfig rejects unknown top-level keys with a path", () => {
  assert.throws(
    () => validateConfig({ version: 1, operatorMap: {} }),
    (err: unknown) => err instanceof ConfigError && err.path === "operatorMap",
  );
});

test("validateConfig rejects a routing rule missing project", () => {
  assert.throws(
    () => validateConfig({ routing: [{ channel: "#acme-shop" }] }),
    (err: unknown) =>
      err instanceof ConfigError && /routing\[0\]\.project/.test((err as Error).message),
  );
});

test("validateConfig rejects an invalid sanitization regex at load time", () => {
  assert.throws(
    () =>
      validateConfig({
        sanitization: [{ name: "broken", pattern: "([unterminated" }],
      }),
    (err: unknown) =>
      err instanceof ConfigError && /sanitization\[0\]\.pattern/.test((err as Error).message),
  );
});

test("validateConfig rejects reserveTokens >= maxTokens", () => {
  assert.throws(
    () => validateConfig({ budget: { maxTokens: 100, reserveTokens: 100 } }),
    (err: unknown) => err instanceof ConfigError && /reserveTokens/.test((err as Error).message),
  );
});

test("Fabric constructor fail-fasts on invalid config", () => {
  assert.throws(() => new Fabric({ budget: { maxTokens: 0 } }), ConfigError);
});

test("empty object is a valid config (all sections optional)", () => {
  assert.deepEqual(validateConfig({}), {});
});
