import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { ExpenseStore } from "./expense.store";
import type { CreateExpenseInput, ExpenseInputSource, ExpenseRecord } from "./expense.types";

type ExpenseRow = RowDataPacket & {
  id: string;
  user_id: string;
  category_code: ExpenseRecord["category"];
  description: string;
  amount: number | string;
  spent_date: string | Date;
  recurring_id: string | null;
  input_text: string | null;
  input_source: string | null;
  created_at: Date;
  updated_at: Date;
};

function toInputSource(value: string | null): ExpenseInputSource | null {
  return value === "voice" || value === "text" ? value : null;
}

function toExpenseRecord(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category_code,
    description: row.description,
    amount: Number(row.amount),
    spentDate:
      row.spent_date instanceof Date
        ? row.spent_date.toISOString().slice(0, 10)
        : String(row.spent_date),
    recurringId: row.recurring_id ?? null,
    inputText: row.input_text ?? null,
    inputSource: toInputSource(row.input_source),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export class MySqlExpenseRepository implements ExpenseStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateExpenseInput): Promise<ExpenseRecord> {
    await this.pool.execute(
      `INSERT INTO expenses (id, user_id, category_code, description, amount, spent_date, recurring_id, input_text, input_source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.category,
        input.description,
        input.amount,
        input.spentDate,
        input.recurringId ?? null,
        input.inputText ?? null,
        input.inputSource ?? null,
        new Date(input.createdAt),
        new Date(input.updatedAt)
      ]
    );

    return {
      id: input.id,
      userId: input.userId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      spentDate: input.spentDate,
      recurringId: input.recurringId ?? null,
      inputText: input.inputText ?? null,
      inputSource: input.inputSource ?? null,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };
  }

  async listByUserId(userId: string): Promise<ExpenseRecord[]> {
    const [rows] = await this.pool.query<ExpenseRow[]>(
      `SELECT id, user_id, category_code, description, amount, spent_date, recurring_id, input_text, input_source, created_at, updated_at
       FROM expenses
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return rows.map(toExpenseRecord);
  }

  async findById(id: string): Promise<ExpenseRecord | null> {
    const [rows] = await this.pool.query<ExpenseRow[]>(
      `SELECT id, user_id, category_code, description, amount, spent_date, recurring_id, input_text, input_source, created_at, updated_at
       FROM expenses
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const row = rows[0];
    return row ? toExpenseRecord(row) : null;
  }

  async findByRecurringAndDate(recurringId: string, spentDate: string): Promise<ExpenseRecord | null> {
    const [rows] = await this.pool.query<ExpenseRow[]>(
      `SELECT id, user_id, category_code, description, amount, spent_date, recurring_id, input_text, input_source, created_at, updated_at
       FROM expenses
       WHERE recurring_id = ? AND spent_date = ?
       LIMIT 1`,
      [recurringId, spentDate]
    );

    const row = rows[0];
    return row ? toExpenseRecord(row) : null;
  }

  async update(
    expenseId: string,
    input: {
      category: CreateExpenseInput["category"];
      description: string;
      amount: number;
      spentDate: string;
      updatedAt: string;
    }
  ): Promise<ExpenseRecord | null> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE expenses
       SET category_code = ?, description = ?, amount = ?, spent_date = ?, updated_at = ?
       WHERE id = ?`,
      [input.category, input.description, input.amount, input.spentDate, new Date(input.updatedAt), expenseId]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(expenseId);
  }

  async delete(expenseId: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM expenses WHERE id = ?`,
      [expenseId]
    );

    return result.affectedRows > 0;
  }
}
