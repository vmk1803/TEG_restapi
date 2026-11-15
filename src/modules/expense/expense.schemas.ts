import { z } from "zod";
import { incomeCategories } from "../income/income.types";

const categoryCodes = incomeCategories.map((category) => category.code);

export const expensePayloadSchema = z.object({
  category: z.enum(categoryCodes),
  description: z.string().trim().min(1).max(255),
  amount: z.number().positive(),
  spentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "spentDate must be in YYYY-MM-DD format")
});

export const expenseIdParamSchema = z.object({
  expenseId: z.uuid()
});
