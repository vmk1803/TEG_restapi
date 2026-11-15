import type { Pool, RowDataPacket } from "mysql2/promise";
import type { RefreshTokenStore } from "./refresh-token.store";
import type {
  CreateRefreshTokenInput,
  RefreshTokenRecord,
  RotateRefreshTokenInput
} from "./refresh-token.types";

type RefreshTokenRow = RowDataPacket & {
  id: string;
  user_id: string;
  token_hash: string;
  previous_token_hash: string | null;
  previous_rotated_at: Date | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: RefreshTokenRow): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    previousTokenHash: row.previous_token_hash,
    previousRotatedAt: row.previous_rotated_at ? row.previous_rotated_at.toISOString() : null,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export class MySqlRefreshTokenRepository implements RefreshTokenStore {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    await this.pool.execute(
      `INSERT INTO refresh_tokens
        (id, user_id, token_hash, previous_token_hash, previous_rotated_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.tokenHash,
        new Date(input.expiresAt),
        new Date(input.createdAt),
        new Date(input.createdAt)
      ]
    );

    return {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      previousTokenHash: null,
      previousRotatedAt: null,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  }

  async findByCurrentHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [rows] = await this.pool.query<RefreshTokenRow[]>(
      `SELECT id, user_id, token_hash, previous_token_hash, previous_rotated_at,
              expires_at, created_at, updated_at
       FROM refresh_tokens
       WHERE token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByPreviousHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [rows] = await this.pool.query<RefreshTokenRow[]>(
      `SELECT id, user_id, token_hash, previous_token_hash, previous_rotated_at,
              expires_at, created_at, updated_at
       FROM refresh_tokens
       WHERE previous_token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<RefreshTokenRecord | null> {
    const [rows] = await this.pool.query<RefreshTokenRow[]>(
      `SELECT id, user_id, token_hash, previous_token_hash, previous_rotated_at,
              expires_at, created_at, updated_at
       FROM refresh_tokens
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async rotate(input: RotateRefreshTokenInput): Promise<void> {
    await this.pool.execute(
      `UPDATE refresh_tokens
       SET token_hash = ?,
           previous_token_hash = ?,
           previous_rotated_at = ?,
           expires_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        input.newTokenHash,
        input.previousTokenHash,
        new Date(input.rotatedAt),
        new Date(input.expiresAt),
        new Date(input.rotatedAt),
        input.id
      ]
    );
  }

  async deleteById(id: string): Promise<void> {
    await this.pool.execute(`DELETE FROM refresh_tokens WHERE id = ?`, [id]);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.pool.execute(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);
  }
}
