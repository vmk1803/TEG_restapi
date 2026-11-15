import type {
  CreateRefreshTokenInput,
  RefreshTokenRecord,
  RotateRefreshTokenInput
} from "./refresh-token.types";

export interface RefreshTokenStore {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord>;
  findByCurrentHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  findByPreviousHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  findByUserId(userId: string): Promise<RefreshTokenRecord | null>;
  rotate(input: RotateRefreshTokenInput): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
