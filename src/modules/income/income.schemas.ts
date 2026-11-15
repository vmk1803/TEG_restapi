import { z } from "zod";
import { incomeCategories } from "./income.types";

const categoryCodes = incomeCategories.map((category) => category.code);

const allocationSchema = z.object({
  category: z.enum(categoryCodes),
  limit: z.number().positive()
});

export const incomePayloadSchema = z.object({
  totalIncome: z.number().positive(),
  allocations: z.array(allocationSchema).min(1).max(10)
});

export const incomeIdParamSchema = z.object({
  incomeId: z.uuid()
});

export type IncomePayload = z.infer<typeof incomePayloadSchema>;
