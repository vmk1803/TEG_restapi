import type { Role } from "../modules/users/user.types";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
