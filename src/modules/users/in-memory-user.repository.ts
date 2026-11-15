import type { CreateUserInput, SafeUser, UserRecord } from "./user.types";
import type { UserStore } from "./user.store";

export class InMemoryUserRepository implements UserStore {
  private readonly users = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalizedEmail = email.toLowerCase();

    for (const user of this.users.values()) {
      if (user.email === normalizedEmail) {
        return { ...user };
      }
    }

    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = {
      id: input.id,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt
    };

    this.users.set(user.id, user);
    return { ...user };
  }

  async updatePassword(userId: string, passwordHash: string, updatedAt: string): Promise<void> {
    const existing = this.users.get(userId);

    if (!existing) {
      return;
    }

    this.users.set(userId, {
      ...existing,
      passwordHash,
      updatedAt
    });
  }

  async listSafeUsers(): Promise<SafeUser[]> {
    return Array.from(this.users.values())
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(({ passwordHash, ...safeUser }) => ({ ...safeUser }));
  }
}
