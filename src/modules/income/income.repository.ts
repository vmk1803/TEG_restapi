import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { IncomeStore } from "./income.store";
import type { CreateIncomeInput, IncomeAllocation, IncomeRecord } from "./income.types";

type IncomeRow = RowDataPacket & {
  id: string;
  user_id: string;
  total_income: number | string;
  allocations_json: string | IncomeAllocation[];
  created_at: Date;
  updated_at: Date;
};

function parseAllocations(rawAllocations: IncomeRow["allocations_json"]): IncomeAllocation[] {
  if (typeof rawAllocations === "string") {
    return JSON.parse(rawAllocations) as IncomeAllocation[];
  }

  return rawAllocations;
}

function toIncomeRecord(row: IncomeRow): IncomeRecord {
  return {
    id: row.id,
    userId: row.user_id,
    totalIncome: Number(row.total_income),
    allocations: parseAllocations(row.allocations_json),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export class MySqlIncomeRepository implements IncomeStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateIncomeInput): Promise<IncomeRecord> {
    await this.pool.execute(
      `INSERT INTO incomes (id, user_id, total_income, allocations_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.totalIncome,
        JSON.stringify(input.allocations),
        new Date(input.createdAt),
        new Date(input.updatedAt)
      ]
    );

    return {
      id: input.id,
      userId: input.userId,
      totalIncome: input.totalIncome,
      allocations: input.allocations,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };
  }

  async listByUserId(userId: string): Promise<IncomeRecord[]> {
    const [rows] = await this.pool.query<IncomeRow[]>(
      `SELECT id, user_id, total_income, allocations_json, created_at, updated_at
       FROM incomes
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return rows.map(toIncomeRecord);
  }

  async findLatestByUserId(userId: string): Promise<IncomeRecord | null> {
    const [rows] = await this.pool.query<IncomeRow[]>(
      `SELECT id, user_id, total_income, allocations_json, created_at, updated_at
       FROM incomes
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const row = rows[0];
    return row ? toIncomeRecord(row) : null;
  }

  async findById(id: string): Promise<IncomeRecord | null> {
    const [rows] = await this.pool.query<IncomeRow[]>(
      `SELECT id, user_id, total_income, allocations_json, created_at, updated_at
       FROM incomes
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    const row = rows[0];
    return row ? toIncomeRecord(row) : null;
  }

  async update(
    incomeId: string,
    input: { totalIncome: number; allocations: IncomeAllocation[]; updatedAt: string }
  ): Promise<IncomeRecord | null> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE incomes
       SET total_income = ?, allocations_json = ?, updated_at = ?
       WHERE id = ?`,
      [input.totalIncome, JSON.stringify(input.allocations), new Date(input.updatedAt), incomeId]
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return this.findById(incomeId);
  }

  async delete(incomeId: string): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `DELETE FROM incomes WHERE id = ?`,
      [incomeId]
    );

    return result.affectedRows > 0;
  }
}
