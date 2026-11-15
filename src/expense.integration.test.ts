import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "./test-support/create-test-app";

const buildTestContext = createTestApp;

async function signupAndGetToken(app: ReturnType<typeof buildTestContext>["app"], email: string) {
  const response = await request(app).post("/api/auth/signup").send({
    fullName: email.split("@")[0],
    email,
    password: "Password123"
  });

  return response.body.accessToken as string;
}

describe("expense flow", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  it("returns predefined categories for authenticated users", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "expense-categories@example.com");

    const response = await request(context.app)
      .get("/api/expenses/categories")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.categories.length).toBeGreaterThan(0);
    expect(response.body.categories[0]).toHaveProperty("code");
    expect(response.body.categories[0]).toHaveProperty("name");
  });

  it("creates and lists expense entries for the authenticated user", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "expense@example.com");

    const createResponse = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "FOOD",
        description: "Lunch at cafe",
        amount: 250,
        spentDate: "2026-05-02"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.expense.categoryName).toBe("Food");
    expect(createResponse.body.expense.spentDate).toBe("2026-05-02");

    const listResponse = await request(context.app)
      .get("/api/expenses")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.expenses).toHaveLength(1);
    expect(listResponse.body.expenses[0].description).toBe("Lunch at cafe");
  });

  it("returns only the requesting user's expense entries", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const firstToken = await signupAndGetToken(context.app, "spender@example.com");
    const secondToken = await signupAndGetToken(context.app, "viewer@example.com");

    await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${firstToken}`)
      .send({
        category: "TRANSPORT",
        description: "Cab ride",
        amount: 500,
        spentDate: "2026-05-02"
      });

    const response = await request(context.app)
      .get("/api/expenses")
      .set("Authorization", `Bearer ${secondToken}`);

    expect(response.status).toBe(200);
    expect(response.body.expenses).toHaveLength(0);
  });

  it("rejects invalid categories", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "bad-category@example.com");

    const response = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "CRYPTO",
        description: "Token purchase",
        amount: 1200,
        spentDate: "2026-05-02"
      });

    expect(response.status).toBe(400);
  });

  it("rejects blank descriptions", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "blank-desc@example.com");

    const response = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "OTHER",
        description: "   ",
        amount: 100,
        spentDate: "2026-05-02"
      });

    expect(response.status).toBe(400);
  });

  it("rejects zero or negative amounts", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "bad-amount@example.com");

    const response = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "OTHER",
        description: "Stationery",
        amount: 0,
        spentDate: "2026-05-02"
      });

    expect(response.status).toBe(400);
  });

  it("rejects invalid spentDate values", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "bad-date@example.com");

    const response = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "OTHER",
        description: "Stationery",
        amount: 100,
        spentDate: "02-05-2026"
      });

    expect(response.status).toBe(400);
  });

  it("updates expense entries for the owner", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "expense-update@example.com");

    const createResponse = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "ENTERTAINMENT",
        description: "Movie",
        amount: 400,
        spentDate: "2026-05-01"
      });

    const expenseId = createResponse.body.expense.id as string;
    const updateResponse = await request(context.app)
      .put(`/api/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "FOOD",
        description: "Dinner",
        amount: 650,
        spentDate: "2026-05-02"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.expense.category).toBe("FOOD");
    expect(updateResponse.body.expense.description).toBe("Dinner");
    expect(updateResponse.body.expense.amount).toBe(650);
    expect(updateResponse.body.expense.spentDate).toBe("2026-05-02");
  });

  it("rejects updates to another user's expense entry", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const ownerToken = await signupAndGetToken(context.app, "expense-owner@example.com");
    const intruderToken = await signupAndGetToken(context.app, "expense-intruder@example.com");

    const createResponse = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        category: "HEALTHCARE",
        description: "Medicine",
        amount: 800,
        spentDate: "2026-05-02"
      });

    const response = await request(context.app)
      .put(`/api/expenses/${createResponse.body.expense.id}`)
      .set("Authorization", `Bearer ${intruderToken}`)
      .send({
        category: "HEALTHCARE",
        description: "Updated medicine",
        amount: 900,
        spentDate: "2026-05-03"
      });

    expect(response.status).toBe(404);
  });

  it("deletes expense entries for the owner", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "expense-delete@example.com");

    const createResponse = await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "UTILITIES",
        description: "Electricity bill",
        amount: 1500,
        spentDate: "2026-05-02"
      });

    const deleteResponse = await request(context.app)
      .delete(`/api/expenses/${createResponse.body.expense.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);

    const listResponse = await request(context.app)
      .get("/api/expenses")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.expenses).toHaveLength(0);
  });
});
