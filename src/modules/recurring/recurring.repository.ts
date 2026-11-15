import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { RecurringExpenseStore } from "./recurring.store";
import type { CreateRecurringExpenseInput, RecurringExpenseRecord } from "./recurring.types";

type RecurringRow = RowDataPacket & {
  id: string;
  user_id: string;
  category_code: RecurringExpenseRecord["category"];
  description: string;
  amount: number | string;
  active: number;
  created_at: Date;
  updated_at: Date;
};

function toRecurringRecord(row: RecurringRow): RecurringExpenseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category_code,
    description: row.description,
    amount: Number(row.amount),
    active: Boolean(row.active),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export class MySqlRecurringExpenseRepository implements RecurringExpenseStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateRecurringExpenseInput): Promise<RecurringExpenseRecord> {
    await this.pool.execute(
      `INSERT INTO recurring_expenses
         (id, user_id, category_code, description, amount, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.category,
        input.description,
        input.amount,
        input.active ? 1 : 0,
        new Date(input.createdAt),
        new Date(input.updatedAt)
      ]
    );

    return { ...input };
  }

  async listByUserId(userId: string): Promise<RecurringExpenseRecord[]> {
    const [rows] = await this.pool.query<RecurringRow[]>(
      `SELECT id, user_id, category_code, description, amount, active, created_at, updated_at
       FROM recurring_expenses
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return rows.map(toRecurringRecord);
  }

  async listAllActive(): Promise<RecurringExpenseRecord[]> {
    const [rows] = await this.pool.query<RecurringRow[]>(
      `SELECT id, user_id, category_code, description, amount, active, created_at, updated_at
       FROM recurring_expenses
       WHERE active = 1`
    );

    return rows.map(toRecurringRecord);
  }

  async findById(id: string): Promise<RecurringExpenseRecord | null> {
    const [rows] = await this.pool.query<RecurringRow[]>(
      `SELECT id, user_id, category_code, description, amount, active, created_at, updated_at
       FROM recurring_expenses
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const row = rows[0];
    return row ? toRecurringRecord(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM recurring_expenses WHERE id = ?`,
      [id]
    );

    return result.affectedRows > 0;
  }
}
