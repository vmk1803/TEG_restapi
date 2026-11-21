import type { IncomeCategoryCode } from "../income/income.types";

/** One parsed field. `value` is null when nothing was found; `confidence` is 0–1. */
export type FieldResult<T> = {
  value: T | null;
  confidence: number;
};

/** Provider-neutral chat message (the OpenAI-style shape most LLM APIs accept). */
export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

/** Groq connection settings, read from .env and passed in through createApp. */
export type GroqConfig = {
  apiKey: string;
  apiUrl: string;
  model: string;
};

export type ParseExpenseInput = {
  userId: string;
  /** The sentence the user typed or dictated (trimmed, 1–500 chars). */
  text: string;
  /** The client's local date (YYYY-MM-DD), so "yesterday" resolves in the user's timezone. */
  today: string;
};

/**
 * Mirrors the frontend `ParsedExpense` field shape (minus rule-parser warnings),
 * so the client can merge each field with its own rule result.
 */
export type ParsedExpenseResult = {
  rawText: string;
  amount: FieldResult<number>;
  /** YYYY-MM-DD */
  spentDate: FieldResult<string>;
  category: FieldResult<IncomeCategoryCode>;
  description: FieldResult<string>;
};
