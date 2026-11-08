import "server-only";
import { localToday } from "@/lib/dates";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { TRANSCRIPTION_SYSTEM_PROMPT, TRANSCRIPTION_USER_INSTRUCTION } from "../prompt";
import { ExtractionError, type ExtractionProvider } from "./types";

interface OpenAIProviderOptions {
  apiKey: string;
  model: string;
  /** Model that reads page images; can be stronger than the one that structures text. */
  visionModel: string;
  /** Any OpenAI-compatible endpoint (e.g. Gemini, OpenRouter) can be used via a base URL. */
  baseURL?: string;
}

/** Maps OpenAI's failures onto messages staff can act on; anything else is rethrown as is. */
function toExtractionError(error: unknown): unknown {
  if (error instanceof ExtractionError) return error;
  // OpenAI also uses 429 when the account is out of credit — that is not a "try again" situation.
  if (error instanceof OpenAI.RateLimitError && (error.type === "insufficient_quota" || error.code === "insufficient_quota" || error.code === "credit_balance_exhausted")) {
    console.error("[extract] OpenAI account has no remaining credit");
    return new ExtractionError("not_configured", "The AI account has run out of credit, so automatic reading is unavailable. Please ask your administrator to top it up, or enter the details manually.", 503);
  }
  if (error instanceof OpenAI.RateLimitError) return new ExtractionError("rate_limited", "The AI service is busy. Please try again in a minute.", 429);
  if (error instanceof OpenAI.AuthenticationError) return new ExtractionError("not_configured", "AI extraction is not set up correctly. Please contact your administrator.", 503);
  return error;
}

export function createOpenAIProvider(options: OpenAIProviderOptions): ExtractionProvider {
  const client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL, maxRetries: 1 });

  return {
    name: `openai:${options.model}`,
    isDemo: false,
    async transcribe(images, signal) {
      try {
        const completion = await client.chat.completions.create(
          {
            model: options.visionModel,
            temperature: 0,
            messages: [
              { role: "system", content: TRANSCRIPTION_SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "text", text: TRANSCRIPTION_USER_INSTRUCTION },
                  ...images.map((image): ChatCompletionContentPart => ({
                    type: "image_url",
                    image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: "high" },
                  })),
                ],
              },
            ],
          },
          { signal },
        );
        const message = completion.choices[0]?.message;
        if (message?.refusal) throw new ExtractionError("ai_failed", "The AI could not read this document.");
        return message?.content ?? "";
      } catch (error) {
        throw toExtractionError(error);
      }
    },
    async extract(documentText, task, signal) {
      try {
        const completion = await client.chat.completions.create(
          {
            model: options.model,
            temperature: 0,
            response_format: zodResponseFormat(task.schema, task.name),
            messages: [
              { role: "system", content: task.systemPrompt(localToday()) },
              {
                role: "user",
                content: [
                  { type: "text", text: task.userInstruction },
                  { type: "text", text: `<supplier_document>\n${documentText}\n</supplier_document>` },
                ],
              },
            ],
          },
          { signal },
        );
        const message = completion.choices[0]?.message;
        if (message?.refusal || !message?.content)
          throw new ExtractionError("ai_failed", "The AI could not read this document.");
        return JSON.parse(message.content);
      } catch (error) {
        throw toExtractionError(error);
      }
    },
  };
}
