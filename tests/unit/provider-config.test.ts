import { afterEach, expect, test } from "bun:test";
import { configuredProvider } from "../../lib/server/rag";
const names = [
  "LLM_PROVIDER",
  "LLM_BASE_URL",
  "LLM_MODEL",
  "LLM_API_KEY",
  "LLM_TRUSTED_HOSTS",
  "LLM_PROMPT_CACHE",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "EMBEDDING_BASE_URL",
  "EMBEDDING_API_KEY",
  "EMBEDDING_MODEL",
  "EMBEDDING_SEND_DIMENSIONS",
];
const saved = new Map(names.map((name) => [name, process.env[name]]));
function reset() {
  for (const name of names) delete process.env[name];
}
afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});
test("the default provider never spends a configured API key", () => {
  reset();
  process.env.LLM_API_KEY = "test-only-key";
  expect(configuredProvider().name).toBe("offline-extractive-mock");
});
test("provider-specific fallback keys never cross origins", () => {
  reset();
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_MODEL = "test-model";
  process.env.OPENAI_API_KEY = "test-only-openai-key";
  expect(() => configuredProvider()).toThrow("LLM_API_KEY");
});
test("separate embedding origins require an explicit separate key", () => {
  reset();
  Object.assign(process.env, {
    LLM_PROVIDER: "openai",
    LLM_MODEL: "test-model",
    LLM_API_KEY: "test-only-key",
    EMBEDDING_BASE_URL: "https://openrouter.ai/api/v1",
  });
  expect(() => configuredProvider()).toThrow("separate EMBEDDING_API_KEY");
});
test("trusted deployment hosts enable another compatible API without a network call", () => {
  reset();
  Object.assign(process.env, {
    LLM_PROVIDER: "openai-compatible",
    LLM_MODEL: "test-model",
    LLM_API_KEY: "test-only-key",
    LLM_BASE_URL: "https://llm.example/v1",
    LLM_TRUSTED_HOSTS: "llm.example, embeddings.example",
    EMBEDDING_BASE_URL: "https://embeddings.example/v1",
    EMBEDDING_API_KEY: "test-only-embedding-key",
  });
  const provider = configuredProvider();
  expect(provider.identity.provider).toBe("embeddings.example");
  expect(provider.identity.dimensions).toBe(256);
});
