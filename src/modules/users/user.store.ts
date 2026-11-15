import type { CreateUserInput, SafeUser, UserRecord } from "./user.types";

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
  updatePassword(userId: string, passwordHash: string, updatedAt: string): Promise<void>;
  listSafeUsers(): Promise<SafeUser[]>;
}
