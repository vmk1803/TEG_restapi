export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  previousTokenHash: string | null;
  previousRotatedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateRefreshTokenInput = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
};

export type RotateRefreshTokenInput = {
  id: string;
  newTokenHash: string;
  previousTokenHash: string;
  rotatedAt: string;
  expiresAt: string;
};
