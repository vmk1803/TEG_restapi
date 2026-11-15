import type { Pool, RowDataPacket } from "mysql2/promise";
import type { SafeUser, UserRecord } from "./user.types";
import type { CreateUserInput } from "./user.types";
import type { UserStore } from "./user.store";

type UserRow = RowDataPacket & {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: UserRecord["role"];
  created_at: Date;
  updated_at: Date;
};

function mapUser(record: UserRow): UserRecord {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    passwordHash: record.password_hash,
    role: record.role,
    createdAt: record.created_at.toISOString(),
    updatedAt: record.updated_at.toISOString()
  };
}

export function toSafeUser(user: UserRecord): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export class MySqlUserRepository implements UserStore {
  constructor(private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [rows] = await this.pool.query<UserRow[]>(
      `SELECT id, full_name, email, password_hash, role, created_at, updated_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email.toLowerCase()]
    );
    const user = rows[0];

    return user ? mapUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [rows] = await this.pool.query<UserRow[]>(
      `SELECT id, full_name, email, password_hash, role, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const user = rows[0];

    return user ? mapUser(user) : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    await this.pool.execute(
      `INSERT INTO users (id, full_name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.fullName,
        input.email.toLowerCase(),
        input.passwordHash,
        input.role,
        new Date(input.createdAt),
        new Date(input.updatedAt)
      ]
    );

    return {
      id: input.id,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };
  }

  async updatePassword(userId: string, passwordHash: string, updatedAt: string): Promise<void> {
    await this.pool.execute(
      `UPDATE users
       SET password_hash = ?, updated_at = ?
       WHERE id = ?`,
      [passwordHash, new Date(updatedAt), userId]
    );
  }

  async listSafeUsers(): Promise<SafeUser[]> {
    const [users] = await this.pool.query<UserRow[]>(
      `SELECT id, full_name, email, password_hash, role, created_at, updated_at
       FROM users
       ORDER BY created_at ASC`
    );

    return users.map((user) => toSafeUser(mapUser(user)));
  }
}
