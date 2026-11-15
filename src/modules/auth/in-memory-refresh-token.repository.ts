import type { RefreshTokenStore } from "./refresh-token.store";
import type {
  CreateRefreshTokenInput,
  RefreshTokenRecord,
  RotateRefreshTokenInput
} from "./refresh-token.types";

export class InMemoryRefreshTokenRepository implements RefreshTokenStore {
  private readonly tokens = new Map<string, RefreshTokenRecord>();

  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const record: RefreshTokenRecord = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      previousTokenHash: null,
      previousRotatedAt: null,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };

    this.tokens.set(record.id, record);
    return { ...record };
  }

  async findByCurrentHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const record of this.tokens.values()) {
      if (record.tokenHash === tokenHash) {
        return { ...record };
      }
    }
    return null;
  }

  async findByPreviousHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const record of this.tokens.values()) {
      if (record.previousTokenHash === tokenHash) {
        return { ...record };
      }
    }
    return null;
  }

  async findByUserId(userId: string): Promise<RefreshTokenRecord | null> {
    for (const record of this.tokens.values()) {
      if (record.userId === userId) {
        return { ...record };
      }
    }
    return null;
  }

  async rotate(input: RotateRefreshTokenInput): Promise<void> {
    const existing = this.tokens.get(input.id);
    if (!existing) {
      return;
    }

    this.tokens.set(input.id, {
      ...existing,
      tokenHash: input.newTokenHash,
      previousTokenHash: input.previousTokenHash,
      previousRotatedAt: input.rotatedAt,
      expiresAt: input.expiresAt,
      updatedAt: input.rotatedAt
    });
  }

  async deleteById(id: string): Promise<void> {
    this.tokens.delete(id);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [id, record] of this.tokens.entries()) {
      if (record.userId === userId) {
        this.tokens.delete(id);
      }
    }
  }
}
