import "server-only";
import { localToday } from "@/lib/dates";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { extractionSchema } from "../../schema";
import { buildExtractionSystemPrompt, EXTRACTION_USER_INSTRUCTION } from "../prompt";
import { ExtractionError, type ExtractionInput, type ExtractionProvider } from "./types";

interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  /** Any OpenAI-compatible endpoint (e.g. Gemini, OpenRouter) can be used via a base URL. */
  baseURL?: string;
}

function toContent(input: ExtractionInput): ChatCompletionContentPart[] {
  const instruction: ChatCompletionContentPart = { type: "text", text: EXTRACTION_USER_INSTRUCTION };
  if (input.kind === "text") {
    return [
      instruction,
      { type: "text", text: `<supplier_document>\n${input.text}\n</supplier_document>` },
    ];
  }
  const dataUrl = `data:${input.mimeType};base64,${input.base64}`;
  if (input.mimeType === "application/pdf") {
    return [instruction, { type: "file", file: { filename: "supplier.pdf", file_data: dataUrl } }];
  }
  return [instruction, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }];
}

export function createOpenAIProvider(options: OpenAIProviderOptions): ExtractionProvider {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL, maxRetries: 1 });

  return {
    name: `openai:${options.model}`,
    isDemo: false,
    async extract(input, signal) {
      try {
        const completion = await client.chat.completions.create(
          {
            model: options.model,
            temperature: 0,
            response_format: zodResponseFormat(extractionSchema, "flight_quotation"),
            messages: [
              { role: "system", content: buildExtractionSystemPrompt(localToday()) },
              { role: "user", content: toContent(input) },
            ],
          },
          { signal },
        );
        const message = completion.choices[0]?.message;
        if (message?.refusal || !message?.content)
          throw new ExtractionError("ai_failed", "The AI could not read this document.");
        return JSON.parse(message.content);
      } catch (error) {
        if (error instanceof ExtractionError) throw error;
        // OpenAI also uses 429 when the account is out of credit — that is not a "try again" situation.
        if (error instanceof OpenAI.RateLimitError && (error.type === "insufficient_quota" || error.code === "insufficient_quota" || error.code === "credit_balance_exhausted")) {
          console.error("[extract] OpenAI account has no remaining credit");
          throw new ExtractionError("not_configured", "The AI account has run out of credit, so automatic reading is unavailable. Please ask your administrator to top it up, or enter the details manually.", 503);
        }
        if (error instanceof OpenAI.RateLimitError)
          throw new ExtractionError("rate_limited", "The AI service is busy. Please try again in a minute.", 429);
        if (error instanceof OpenAI.AuthenticationError)
          throw new ExtractionError("not_configured", "AI extraction is not set up correctly. Please contact your administrator.", 503);
        throw error;
      }
    },
  };
}
