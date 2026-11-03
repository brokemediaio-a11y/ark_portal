import "server-only";
import { mockExtractionProvider } from "./mock";
import { createOpenAIProvider } from "./openai";
import { ExtractionError, type ExtractionProvider } from "./types";

const DEFAULT_OPENAI_MODEL = "gpt-4o";

/** Picks the extraction backend from environment variables (server-side only). */
export function getExtractionProvider(env: NodeJS.ProcessEnv = process.env): ExtractionProvider {
  const provider = (env.EXTRACTION_PROVIDER ?? "openai").toLowerCase();

  if (provider === "mock") return mockExtractionProvider;

  if (provider === "openai") {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey)
      throw new ExtractionError(
        "not_configured",
        "Automatic reading isn't set up yet (missing AI key). You can still enter the details manually.",
        503,
      );
    return createOpenAIProvider({
      apiKey,
      model: env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      baseURL: env.OPENAI_BASE_URL || undefined,
    });
  }

  throw new ExtractionError("not_configured", `Unknown EXTRACTION_PROVIDER "${provider}".`, 503);
}

export { ExtractionError } from "./types";
export type { ExtractionInput, ExtractionProvider } from "./types";
