import { z } from "zod";
import { incomeCategories } from "../income/income.types";

const categoryCodes = incomeCategories.map((category) => category.code);

export const recurringExpensePayloadSchema = z.object({
  category: z.enum(categoryCodes),
  description: z.string().trim().min(1).max(255),
  amount: z.number().positive()
});

export const recurringExpenseIdParamSchema = z.object({
  recurringId: z.uuid()
});
