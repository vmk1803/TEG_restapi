export const roles = ["USER", "ADMIN"] as const;

export type Role = (typeof roles)[number];

export type UserRecord = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type SafeUser = Omit<UserRecord, "passwordHash">;

export type CreateUserInput = {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};
