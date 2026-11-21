import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-support/create-test-app";

const buildTestContext = createTestApp;
const PARSE_URL = "/api/expenses/parse";

async function signupAndGetToken(app: ReturnType<typeof buildTestContext>["app"], email: string) {
  const response = await request(app).post("/api/auth/signup").send({
    fullName: email.split("@")[0],
    email,
    password: "Password123"
  });
  return response.body.accessToken as string;
}

describe("smart add parse endpoint", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  async function setup(email: string) {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, email);
    const post = (body: unknown) =>
      request(context.app).post(PARSE_URL).set("Authorization", `Bearer ${token}`).send(body as object);
    return { context, post };
  }

  it("requires authentication", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const response = await request(context.app)
      .post(PARSE_URL)
      .send({ text: "250 coffee", today: "2026-11-21" });

    expect(response.status).toBe(401);
  });

  it("rejects missing or blank text", async () => {
    const { post } = await setup("parse-blank@example.com");

    const missing = await post({ today: "2026-11-21" });
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("VALIDATION_FAILED");

    const blank = await post({ text: "   ", today: "2026-11-21" });
    expect(blank.status).toBe(400);
    expect(blank.body.code).toBe("VALIDATION_FAILED");
  });

  it("rejects text longer than 500 characters", async () => {
    const { post } = await setup("parse-long@example.com");

    const response = await post({ text: "a".repeat(501), today: "2026-11-21" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_FAILED");
  });

  it("rejects a malformed today", async () => {
    const { post } = await setup("parse-today@example.com");

    const response = await post({ text: "250 coffee", today: "21-11-2026" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_FAILED");
  });

  it("returns the empty placeholder result with trimmed raw text", async () => {
    const { post } = await setup("parse-ok@example.com");

    const response = await post({ text: "  250 coffee  ", today: "2026-11-21" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      parsed: {
        rawText: "250 coffee",
        amount: { value: null, confidence: 0 },
        spentDate: { value: null, confidence: 0 },
        category: { value: null, confidence: 0 },
        description: { value: null, confidence: 0 }
      }
    });
  });

  it("returns the fields parsed by Groq when a key is configured", async () => {
    const reply = {
      amount: { value: 250, confidence: 0.98 },
      spentDate: { value: "2026-11-20", confidence: 0.95 },
      category: { value: "DINING_OUT", confidence: 0.85 },
      description: { value: "Coffee", confidence: 0.9 }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }), { status: 200 })
      )
    );

    try {
      const context = buildTestContext({
        groq: { apiKey: "test-key", apiUrl: "https://groq.test/chat", model: "test-model" }
      });
      contexts.push(context);
      const token = await signupAndGetToken(context.app, "parse-groq@example.com");
      await request(context.app)
        .post("/api/income")
        .set("Authorization", `Bearer ${token}`)
        .send({ totalIncome: 50000, allocations: [{ category: "DINING_OUT", limit: 4000 }] });

      const response = await request(context.app)
        .post(PARSE_URL)
        .set("Authorization", `Bearer ${token}`)
        .send({ text: "250 coffee yesterday", today: "2026-11-21" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ parsed: { rawText: "250 coffee yesterday", ...reply } });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not affect the expense routes", async () => {
    const { context, post } = await setup("parse-coexist@example.com");
    await post({ text: "250 coffee", today: "2026-11-21" });

    const token = await signupAndGetToken(context.app, "parse-coexist-2@example.com");
    const list = await request(context.app).get("/api/expenses").set("Authorization", `Bearer ${token}`);

    expect(list.status).toBe(200);
    expect(list.body.expenses).toEqual([]);
  });
});
