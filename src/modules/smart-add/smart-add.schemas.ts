import { z } from "zod";
import { incomeCategories } from "../income/income.types";

const categoryCodes = incomeCategories.map((category) => category.code);

export const parseExpenseRequestSchema = z.object({
  // Same cap as inputText on POST /expenses.
  text: z.string().trim().min(1).max(500),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "today must be in YYYY-MM-DD format")
});

/** Out-of-range or missing confidence becomes 0. */
const confidence = z.number().min(0).max(1).catch(0);

const EMPTY_FIELD = { value: null, confidence: 0 };

/**
 * Validates the LLM's JSON reply field by field (see SMART_ADD_SYSTEM_PROMPT output format).
 * Each `{ value, confidence }` field that is invalid becomes an empty field
 * instead of failing the whole reply.
 */
export const llmReplySchema = z.object({
  amount: z.object({ value: z.number().positive().nullable(), confidence }).catch(EMPTY_FIELD),
  spentDate: z
    .object({ value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), confidence })
    .catch(EMPTY_FIELD),
  category: z.object({ value: z.enum(categoryCodes).nullable(), confidence }).catch(EMPTY_FIELD),
  description: z
    .object({ value: z.string().trim().min(1).max(255).nullable(), confidence })
    .catch(EMPTY_FIELD)
});

export type LlmReply = z.infer<typeof llmReplySchema>;
