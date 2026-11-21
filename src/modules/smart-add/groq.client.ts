import type { ChatMessage, GroqConfig } from "./smart-add.types";

/** Total time budget for the call, shared by the first attempt and the retry. */
const REQUEST_TIMEOUT_MS = 10_000;

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

/** One POST to the chat completions endpoint. Throws on any HTTP or shape error. */
async function sendChatCompletionRequest(
  config: GroqConfig,
  messages: ChatMessage[],
  signal: AbortSignal
): Promise<string> {
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: "json_object" }
    }),
    signal
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 500 chars: Groq puts a long `message` before `code`, which the retry check reads.
    throw new Error(`Groq request failed: ${response.status} ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as GroqChatResponse;
  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.length === 0) {
    throw new Error("Groq response had no message content");
  }

  return content;
}

/**
 * Sends the messages to Groq's OpenAI-compatible chat completions endpoint and
 * returns the reply text. JSON mode makes Groq return a single JSON object.
 *
 * Groq sometimes rejects the model's own output in JSON mode
 * (`json_validate_failed`); that one error is retried once, within the same
 * timeout. Anything else throws; the caller decides the fallback.
 */
export async function groqChatCompletion(config: GroqConfig, messages: ChatMessage[]): Promise<string> {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);

  try {
    return await sendChatCompletionRequest(config, messages, signal);
  } catch (error) {
    const isInvalidJson = error instanceof Error && error.message.includes("json_validate_failed");
    if (!isInvalidJson) {
      throw error;
    }

    console.warn("[smart-add] Groq returned invalid JSON, retrying once");
    return sendChatCompletionRequest(config, messages, signal);
  }
}
