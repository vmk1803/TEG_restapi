import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { HttpError } from "../../lib/http-error";
import { createId, createOpaqueToken, hashToken } from "../../lib/crypto";
import { toSafeUser } from "../users/user.repository";
import type { UserStore } from "../users/user.store";
import type { Role, SafeUser, UserRecord } from "../users/user.types";
import { AuthErrorCode } from "./auth.error-codes";
import type { RefreshTokenStore } from "./refresh-token.store";
import type { RefreshTokenRecord } from "./refresh-token.types";

type AuthConfig = {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenTtlSeconds: number;
  refreshRotationThresholdSeconds: number;
};

type AuthTokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  user: SafeUser;
};

export class AuthService {
  constructor(
    private readonly userRepository: UserStore,
    private readonly refreshTokenRepository: RefreshTokenStore,
    private readonly config: AuthConfig
  ) {}

  async signup(input: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<AuthSession> {
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new HttpError(409, "An account with this email already exists.", AuthErrorCode.DUPLICATE_EMAIL);
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.userRepository.create({
      id: createId(),
      fullName: input.fullName.trim(),
      email: input.email.toLowerCase(),
      passwordHash,
      role: "USER",
      createdAt: now,
      updatedAt: now
    });

    return this.startSession(user);
  }

  async loginWithCredentials(input: {
    email: string;
    password: string;
  }): Promise<AuthSession> {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new HttpError(401, "Invalid email or password.", AuthErrorCode.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new HttpError(401, "Invalid email or password.", AuthErrorCode.INVALID_CREDENTIALS);
    }

    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const presentedHash = hashToken(refreshToken);
    const now = new Date();

    const currentMatch = await this.refreshTokenRepository.findByCurrentHash(presentedHash);
    if (currentMatch) {
      return this.handleCurrentMatch(currentMatch, now);
    }

    const previousMatch = await this.refreshTokenRepository.findByPreviousHash(presentedHash);
    if (previousMatch) {
      // The active session for this user belongs to a different login (the
      // most recent login or rotation moved this hash into previous_token_hash).
      // We do NOT delete the row — it belongs to whoever is logged in now.
      throw new HttpError(
        401,
        "You have been logged in on another device. Please log in again.",
        AuthErrorCode.LOGGED_IN_ELSEWHERE
      );
    }

    throw new HttpError(
      401,
      "Unknown refresh token. Please log in again.",
      AuthErrorCode.UNKNOWN_REFRESH_TOKEN
    );
  }

  async logout(refreshToken: string): Promise<void> {
    // Only the holder of the active token can end the session. A presented
    // token that only matches `previous_token_hash` belongs to an evicted
    // device whose row already represents a newer session — leave it alone.
    const presentedHash = hashToken(refreshToken);
    const currentMatch = await this.refreshTokenRepository.findByCurrentHash(presentedHash);
    if (currentMatch) {
      await this.refreshTokenRepository.deleteById(currentMatch.id);
    }
  }

  async getSafeUser(userId: string): Promise<SafeUser> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, "User not found.", AuthErrorCode.USER_NOT_FOUND);
    }

    return toSafeUser(user);
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new HttpError(404, "User not found.", AuthErrorCode.USER_NOT_FOUND);
    }

    const isCurrentPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new HttpError(
        401,
        "Current password is incorrect.",
        AuthErrorCode.INVALID_CURRENT_PASSWORD
      );
    }

    const nextPasswordHash = await bcrypt.hash(input.newPassword, 10);
    await this.userRepository.updatePassword(user.id, nextPasswordHash, new Date().toISOString());
    await this.refreshTokenRepository.deleteAllForUser(user.id);
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as jwt.JwtPayload;
      return {
        sub: decoded.sub as string,
        email: decoded.email as string,
        role: decoded.role as Role
      };
    } catch {
      throw new HttpError(401, "Invalid or expired token.", AuthErrorCode.INVALID_OR_EXPIRED_TOKEN);
    }
  }

  private async startSession(user: UserRecord): Promise<AuthSession> {
    const now = new Date();
    const refreshToken = createOpaqueToken();
    const newHash = hashToken(refreshToken);
    const expiresAt = new Date(now.getTime() + this.config.refreshTokenTtlSeconds * 1000);

    const existing = await this.refreshTokenRepository.findByUserId(user.id);
    if (existing) {
      // Rotate the row in place. Whatever hash was active before this login
      // is moved into previous_token_hash so the device that held it can be
      // told "logged in on another device" on its next /refresh.
      await this.refreshTokenRepository.rotate({
        id: existing.id,
        newTokenHash: newHash,
        previousTokenHash: existing.tokenHash,
        rotatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
    } else {
      await this.refreshTokenRepository.create({
        id: createId(),
        userId: user.id,
        tokenHash: newHash,
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString()
      });
    }

    return {
      accessToken: this.createAccessToken(user),
      refreshToken,
      user: toSafeUser(user)
    };
  }

  private async handleCurrentMatch(record: RefreshTokenRecord, now: Date): Promise<AuthSession> {
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      await this.refreshTokenRepository.deleteById(record.id);
      throw new HttpError(401, "Session expired. Please log in again.", AuthErrorCode.SESSION_EXPIRED);
    }

    const user = await this.userRepository.findById(record.userId);
    if (!user) {
      await this.refreshTokenRepository.deleteById(record.id);
      throw new HttpError(401, "Session is no longer valid.", AuthErrorCode.SESSION_INVALID);
    }

    const ageSinceLastRotationMs = now.getTime() - Date.parse(record.updatedAt);
    const thresholdMs = this.config.refreshRotationThresholdSeconds * 1000;

    if (ageSinceLastRotationMs < thresholdMs) {
      // Inside the rotation window — issue only a fresh access token. The
      // refresh-token row and the client's cookie stay as they are.
      return {
        accessToken: this.createAccessToken(user),
        refreshToken: null,
        user: toSafeUser(user)
      };
    }

    const newRefreshToken = createOpaqueToken();
    const newExpiresAt = new Date(now.getTime() + this.config.refreshTokenTtlSeconds * 1000);

    await this.refreshTokenRepository.rotate({
      id: record.id,
      newTokenHash: hashToken(newRefreshToken),
      previousTokenHash: record.tokenHash,
      rotatedAt: now.toISOString(),
      expiresAt: newExpiresAt.toISOString()
    });

    return {
      accessToken: this.createAccessToken(user),
      refreshToken: newRefreshToken,
      user: toSafeUser(user)
    };
  }

  private createAccessToken(user: UserRecord): string {
    const options: jwt.SignOptions = {
      subject: user.id,
      expiresIn: this.config.jwtExpiresIn as jwt.SignOptions["expiresIn"]
    };

    return jwt.sign(
      {
        email: user.email,
        role: user.role
      },
      this.config.jwtSecret,
      options
    );
  }
}
