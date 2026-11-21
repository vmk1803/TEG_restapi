import { z } from "zod";
import { incomeCategories } from "../income/income.types";

const categoryCodes = incomeCategories.map((category) => category.code);

export const expensePayloadSchema = z.object({
  category: z.enum(categoryCodes),
  description: z.string().trim().min(1).max(255),
  amount: z.number().positive(),
  spentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "spentDate must be in YYYY-MM-DD format")
});

// POST only. PUT keeps expensePayloadSchema, whose default strip mode drops
// these keys, so edits can never change how an expense was originally entered.
export const createExpensePayloadSchema = expensePayloadSchema
  .extend({
    inputText: z.string().trim().min(1).max(500).optional(),
    inputSource: z.enum(["voice", "text"]).optional()
  })
  .refine(
    (payload) => (payload.inputText === undefined) === (payload.inputSource === undefined),
    {
      message: "inputText and inputSource must be sent together.",
      path: ["inputSource"]
    }
  );

export const expenseIdParamSchema = z.object({
  expenseId: z.uuid()
});
