import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "./test-support/create-test-app";

const buildTestContext = createTestApp;

function extractRefreshCookie(response: request.Response): string | null {
  const setCookie = response.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const cookie of cookies) {
    if (cookie.startsWith("refreshToken=")) {
      // Returns the full `name=value` segment so it can be passed back as a `Cookie` header.
      return cookie.split(";")[0];
    }
  }
  return null;
}

describe("authentication flow", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  it("signs up, logs in, and fetches the current user", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const signupResponse = await request(context.app).post("/api/auth/signup").send({
      fullName: "Vasanth",
      email: "vasanth@example.com",
      password: "Password123"
    });

    expect(signupResponse.status).toBe(201);
    expect(signupResponse.body.user.email).toBe("vasanth@example.com");
    expect(signupResponse.body.accessToken).toBeTypeOf("string");
    expect(signupResponse.body.refreshToken).toBeUndefined();
    expect(extractRefreshCookie(signupResponse)).not.toBeNull();

    const loginResponse = await request(context.app).post("/api/auth/login").send({
      email: "vasanth@example.com",
      password: "Password123"
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTypeOf("string");
    expect(extractRefreshCookie(loginResponse)).not.toBeNull();

    const meResponse = await request(context.app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.fullName).toBe("Vasanth");
  });

  it("blocks duplicate signups", async () => {
    const context = buildTestContext();
    contexts.push(context);

    await request(context.app).post("/api/auth/signup").send({
      fullName: "User One",
      email: "duplicate@example.com",
      password: "Password123"
    });

    const duplicateResponse = await request(context.app).post("/api/auth/signup").send({
      fullName: "User Two",
      email: "duplicate@example.com",
      password: "Password123"
    });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.code).toBe("DUPLICATE_EMAIL");
  });

  it("returns INVALID_CREDENTIALS on bad password", async () => {
    const context = buildTestContext();
    contexts.push(context);

    await request(context.app).post("/api/auth/signup").send({
      fullName: "Login User",
      email: "login@example.com",
      password: "Password123"
    });

    const response = await request(context.app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "WrongPassword123"
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns VALIDATION_FAILED with a code on Zod failures", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const response = await request(context.app).post("/api/auth/login").send({});
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_FAILED");
  });

  it("forbids non-admin users from admin routes", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const signupResponse = await request(context.app).post("/api/auth/signup").send({
      fullName: "Regular User",
      email: "user@example.com",
      password: "Password123"
    });

    const adminResponse = await request(context.app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${signupResponse.body.accessToken}`);

    expect(adminResponse.status).toBe(403);
  });

  it("rejects empty login payloads", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const response = await request(context.app).post("/api/auth/login").send({});

    expect(response.status).toBe(400);
  });

  describe("refresh token flow", () => {
    it("issues a new access token without rotating the refresh token inside the threshold", async () => {
      const context = buildTestContext({ refreshRotationThresholdSeconds: 60 * 60 * 24 });
      contexts.push(context);

      const signup = await request(context.app).post("/api/auth/signup").send({
        fullName: "Threshold User",
        email: "threshold@example.com",
        password: "Password123"
      });
      const cookie = extractRefreshCookie(signup);
      expect(cookie).not.toBeNull();

      const refreshResponse = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie!);

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.accessToken).toBeTypeOf("string");
      // No Set-Cookie because rotation skipped.
      expect(extractRefreshCookie(refreshResponse)).toBeNull();
    });

    it("rotates the refresh token when the threshold has elapsed", async () => {
      const context = buildTestContext({ refreshRotationThresholdSeconds: 0 });
      contexts.push(context);

      const signup = await request(context.app).post("/api/auth/signup").send({
        fullName: "Rotate User",
        email: "rotate@example.com",
        password: "Password123"
      });
      const originalCookie = extractRefreshCookie(signup)!;

      const refreshResponse = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", originalCookie);

      expect(refreshResponse.status).toBe(200);
      const rotatedCookie = extractRefreshCookie(refreshResponse);
      expect(rotatedCookie).not.toBeNull();
      expect(rotatedCookie).not.toBe(originalCookie);
    });

    it("reports 'logged in on another device' when a new login evicts the prior session", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const firstLogin = await request(context.app).post("/api/auth/signup").send({
        fullName: "Multi Device",
        email: "multi@example.com",
        password: "Password123"
      });
      const firstCookie = extractRefreshCookie(firstLogin)!;

      // Second login (e.g. from a different device) — the existing refresh
      // row is rotated in place, with the first device's hash demoted to
      // previous_token_hash.
      const secondLogin = await request(context.app).post("/api/auth/login").send({
        email: "multi@example.com",
        password: "Password123"
      });
      expect(secondLogin.status).toBe(200);

      const refreshFromFirstDevice = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", firstCookie);

      expect(refreshFromFirstDevice.status).toBe(401);
      expect(refreshFromFirstDevice.body.code).toBe("LOGGED_IN_ELSEWHERE");
    });

    it("reports an unknown token when the cookie does not match anything", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const response = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", "refreshToken=totally-bogus-value");

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNKNOWN_REFRESH_TOKEN");
    });

    it("rejects requests without a refresh cookie", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const response = await request(context.app).post("/api/auth/refresh");
      expect(response.status).toBe(401);
      expect(response.body.code).toBe("REFRESH_COOKIE_MISSING");
    });
  });

  describe("logout", () => {
    it("invalidates the active session", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const signup = await request(context.app).post("/api/auth/signup").send({
        fullName: "Logout User",
        email: "logout@example.com",
        password: "Password123"
      });
      const cookie = extractRefreshCookie(signup)!;

      const logoutResponse = await request(context.app)
        .post("/api/auth/logout")
        .set("Cookie", cookie);
      expect(logoutResponse.status).toBe(204);

      const refreshAfterLogout = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie);
      expect(refreshAfterLogout.status).toBe(401);
      expect(refreshAfterLogout.body.code).toBe("UNKNOWN_REFRESH_TOKEN");
    });

    it("does not delete the active session when the cookie only matches the previous hash", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const firstLogin = await request(context.app).post("/api/auth/signup").send({
        fullName: "Stale Logout",
        email: "stale-logout@example.com",
        password: "Password123"
      });
      const firstCookie = extractRefreshCookie(firstLogin)!;

      const secondLogin = await request(context.app).post("/api/auth/login").send({
        email: "stale-logout@example.com",
        password: "Password123"
      });
      const activeCookie = extractRefreshCookie(secondLogin)!;

      // Old device "logs out" using its stale cookie. We must not delete the
      // session that now belongs to the newer login.
      await request(context.app).post("/api/auth/logout").set("Cookie", firstCookie);

      const refreshAfter = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", activeCookie);
      expect(refreshAfter.status).toBe(200);
    });
  });

  describe("password change", () => {
    it("invalidates existing refresh tokens", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const signup = await request(context.app).post("/api/auth/signup").send({
        fullName: "Pwd User",
        email: "pwd@example.com",
        password: "Password123"
      });
      const cookie = extractRefreshCookie(signup)!;

      const change = await request(context.app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${signup.body.accessToken}`)
        .send({
          currentPassword: "Password123",
          newPassword: "NewPassword123"
        });
      expect(change.status).toBe(204);

      const refreshAfterChange = await request(context.app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie);
      expect(refreshAfterChange.status).toBe(401);
    });

    it("returns INVALID_CURRENT_PASSWORD when current password is wrong", async () => {
      const context = buildTestContext();
      contexts.push(context);

      const signup = await request(context.app).post("/api/auth/signup").send({
        fullName: "Wrong Pwd",
        email: "wrong-pwd@example.com",
        password: "Password123"
      });

      const response = await request(context.app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${signup.body.accessToken}`)
        .send({
          currentPassword: "WrongPassword123",
          newPassword: "NewPassword123"
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("INVALID_CURRENT_PASSWORD");
    });
  });
});
