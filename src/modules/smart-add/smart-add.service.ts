import { buildSmartAddSystemPrompt } from "../../config/prompts/smart-add.prompt";
import type { IncomeStore } from "../income/income.store";
import { incomeCategories, type IncomeCategory, type IncomeCategoryCode } from "../income/income.types";
import { groqChatCompletion } from "./groq.client";
import { llmReplySchema, type LlmReply } from "./smart-add.schemas";
import type { ChatMessage, FieldResult, GroqConfig, ParseExpenseInput, ParsedExpenseResult } from "./smart-add.types";

function emptyField<T>(): FieldResult<T> {
  return { value: null, confidence: 0 };
}

function emptyResult(text: string): ParsedExpenseResult {
  return {
    rawText: text,
    amount: emptyField(),
    spentDate: emptyField(),
    category: emptyField(),
    description: emptyField()
  };
}

/** A null value always carries confidence 0. */
function normalize<T>(field: { value: T | null; confidence: number }): FieldResult<T> {
  return field.value === null ? emptyField() : { value: field.value, confidence: field.confidence };
}

/**
 * Applies rules the schema can't know: no future dates (YYYY-MM-DD compares
 * correctly as text) and only categories from the user's budget.
 */
function finalize(
  reply: LlmReply,
  today: string,
  allowedCodes: ReadonlySet<IncomeCategoryCode>
): Omit<ParsedExpenseResult, "rawText"> {
  const spentDate = normalize(reply.spentDate);
  const category = normalize(reply.category);

  return {
    amount: normalize(reply.amount),
    spentDate: spentDate.value !== null && spentDate.value > today ? emptyField() : spentDate,
    category: category.value !== null && !allowedCodes.has(category.value) ? emptyField() : category,
    description: normalize(reply.description)
  };
}

/**
 * AI enhancement for Smart Add: turns a typed or dictated sentence into
 * expense fields using Groq. `groq` is null when GROQ_API_KEY is not set.
 * Any failure returns the empty result so the client keeps its own values.
 */
export class SmartAddService {
  constructor(
    private readonly incomeStore: IncomeStore,
    private readonly groq: GroqConfig | null = null
  ) {}

  /** The categories in the user's latest income plan, in the fixed list's order. Empty when there's no plan. */
  async getUserCategories(userId: string): Promise<IncomeCategory[]> {
    const plan = await this.incomeStore.findLatestByUserId(userId);
    if (!plan) {
      return [];
    }

    const codes = new Set(plan.allocations.map((allocation) => allocation.category));
    return incomeCategories.filter((category) => codes.has(category.code));
  }

  /** The messages sent to the LLM: the system prompt (with the user's categories), then the sentence as-is. */
  buildMessages(input: ParseExpenseInput, categories: readonly IncomeCategory[]): ChatMessage[] {
    return [
      {
        role: "system",
        content: buildSmartAddSystemPrompt({ today: input.today, categories })
      },
      { role: "user", content: input.text }
    ];
  }

  async parseExpense(input: ParseExpenseInput): Promise<ParsedExpenseResult> {
    if (!this.groq) {
      return emptyResult(input.text);
    }

    try {
      const categories = await this.getUserCategories(input.userId);
      if (categories.length === 0) {
        return emptyResult(input.text); // no budget yet: nothing the card could accept
      }

      const content = await groqChatCompletion(this.groq, this.buildMessages(input, categories));
      const reply = llmReplySchema.parse(JSON.parse(content));
      const allowedCodes = new Set(categories.map((category) => category.code));
      return { rawText: input.text, ...finalize(reply, input.today, allowedCodes) };
    } catch (error) {
      console.error("[smart-add] Groq parse failed:", error instanceof Error ? error.message : error);
      return emptyResult(input.text);
    }
  }
}
