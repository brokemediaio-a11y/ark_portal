import "server-only";
import type { ExtractionProvider } from "./types";

/** Demo mode without an AI key: returns each task's fixed sample. The UI labels the result as demo data. */
export const mockExtractionProvider: ExtractionProvider = {
  name: "mock",
  isDemo: true,
  async transcribe() {
    return "";
  },
  async extract(_text, task, signal) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    signal.throwIfAborted();
    return structuredClone(task.demo);
  },
};
