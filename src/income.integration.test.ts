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

describe("income flow", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  it("returns predefined categories for authenticated users", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "categories@example.com");

    const response = await request(context.app)
      .get("/api/income/categories")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.categories.length).toBeGreaterThan(0);
    expect(response.body.categories[0]).toHaveProperty("code");
    expect(response.body.categories[0]).toHaveProperty("name");
  });

  it("creates and lists income entries for the authenticated user", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "income@example.com");

    const createResponse = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 10000,
        allocations: [
          { category: "HOUSING", limit: 3000 },
          { category: "FOOD", limit: 2000 }
        ]
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.income.totalAllocated).toBe(5000);
    expect(createResponse.body.income.remainingIncome).toBe(5000);

    const listResponse = await request(context.app)
      .get("/api/income")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.incomes).toHaveLength(1);
    expect(listResponse.body.incomes[0].allocations[0]).toHaveProperty("categoryName");
  });

  it("returns only the requesting user's income entries", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const firstUserToken = await signupAndGetToken(context.app, "first@example.com");
    const secondUserToken = await signupAndGetToken(context.app, "second@example.com");

    await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${firstUserToken}`)
      .send({
        totalIncome: 9000,
        allocations: [{ category: "SAVINGS", limit: 2000 }]
      });

    const secondUserList = await request(context.app)
      .get("/api/income")
      .set("Authorization", `Bearer ${secondUserToken}`);

    expect(secondUserList.status).toBe(200);
    expect(secondUserList.body.incomes).toHaveLength(0);
  });

  it("rejects more than 10 allocations", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "limit@example.com");

    const response = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 20000,
        allocations: Array.from({ length: 11 }, (_, index) => ({
          category: `CATEGORY_${index}`,
          limit: 100
        }))
      });

    expect(response.status).toBe(400);
  });

  it("rejects invalid category names", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "invalid-category@example.com");

    const response = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 10000,
        allocations: [{ category: "CRYPTO", limit: 2000 }]
      });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate category allocations", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "duplicate-allocation@example.com");

    const response = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 10000,
        allocations: [
          { category: "FOOD", limit: 1000 },
          { category: "FOOD", limit: 1200 }
        ]
      });

    expect(response.status).toBe(400);
  });

  it("rejects allocation totals greater than total income", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "sum@example.com");

    const response = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 1000,
        allocations: [
          { category: "FOOD", limit: 700 },
          { category: "TRANSPORT", limit: 500 }
        ]
      });

    expect(response.status).toBe(400);
  });

  it("updates income entries for the owner", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "update@example.com");

    const createResponse = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 15000,
        allocations: [{ category: "HOUSING", limit: 4000 }]
      });

    const incomeId = createResponse.body.income.id as string;
    const updateResponse = await request(context.app)
      .put(`/api/income/${incomeId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 18000,
        allocations: [
          { category: "HOUSING", limit: 4500 },
          { category: "SAVINGS", limit: 3000 }
        ]
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.income.totalIncome).toBe(18000);
    expect(updateResponse.body.income.totalAllocated).toBe(7500);
  });

  it("rejects updates to another user's income entry", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const firstToken = await signupAndGetToken(context.app, "owner@example.com");
    const secondToken = await signupAndGetToken(context.app, "intruder@example.com");

    const createResponse = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${firstToken}`)
      .send({
        totalIncome: 12000,
        allocations: [{ category: "UTILITIES", limit: 2000 }]
      });

    const response = await request(context.app)
      .put(`/api/income/${createResponse.body.income.id}`)
      .set("Authorization", `Bearer ${secondToken}`)
      .send({
        totalIncome: 13000,
        allocations: [{ category: "UTILITIES", limit: 2100 }]
      });

    expect(response.status).toBe(404);
  });

  it("deletes income entries for the owner", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "delete@example.com");

    const createResponse = await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 11000,
        allocations: [{ category: "OTHER", limit: 1000 }]
      });

    const deleteResponse = await request(context.app)
      .delete(`/api/income/${createResponse.body.income.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(204);

    const listResponse = await request(context.app)
      .get("/api/income")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.incomes).toHaveLength(0);
  });
});
