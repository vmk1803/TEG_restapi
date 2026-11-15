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

describe("overview flow", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  it("returns zeros and expenses when there is no income entry", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "overview-no-income@example.com");

    await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "FOOD",
        description: "Snacks",
        amount: 200,
        spentDate: "2026-05-02"
      });

    const response = await request(context.app)
      .get("/api/overview")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalIncome).toBe(0);
    expect(response.body.summary.totalAllocated).toBe(0);
    expect(response.body.summary.totalSpent).toBe(200);
    expect(response.body.activeIncome).toBeNull();
  });

  it("uses the latest income row as the active budget", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "overview-income@example.com");

    await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 10000,
        allocations: [{ category: "FOOD", limit: 1000 }]
      });

    await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 15000,
        allocations: [
          { category: "FOOD", limit: 2000 },
          { category: "TRANSPORT", limit: 1500 }
        ]
      });

    const response = await request(context.app)
      .get("/api/overview")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalIncome).toBe(15000);
    expect(response.body.summary.totalAllocated).toBe(3500);
    expect(response.body.activeIncome.totalIncome).toBe(15000);
    expect(response.body.activeIncome.allocations).toHaveLength(2);
  });

  it("aggregates spending by category and includes all predefined categories", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "overview-categories@example.com");

    await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${token}`)
      .send({
        totalIncome: 12000,
        allocations: [
          { category: "FOOD", limit: 1500 },
          { category: "UTILITIES", limit: 1000 }
        ]
      });

    await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "FOOD",
        description: "Lunch",
        amount: 300,
        spentDate: "2026-05-02"
      });

    await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        category: "FOOD",
        description: "Dinner",
        amount: 450,
        spentDate: "2026-05-03"
      });

    const response = await request(context.app)
      .get("/api/overview")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalSpent).toBe(750);

    const foodMetric = response.body.categories.find(
      (category: { category: string }) => category.category === "FOOD"
    );
    const educationMetric = response.body.categories.find(
      (category: { category: string }) => category.category === "EDUCATION"
    );

    expect(foodMetric).toMatchObject({
      allocated: 1500,
      spent: 750,
      remaining: 750
    });
    expect(educationMetric).toMatchObject({
      allocated: 0,
      spent: 0,
      remaining: 0
    });
  });

  it("returns only the authenticated user's overview data", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const firstToken = await signupAndGetToken(context.app, "overview-first@example.com");
    const secondToken = await signupAndGetToken(context.app, "overview-second@example.com");

    await request(context.app)
      .post("/api/income")
      .set("Authorization", `Bearer ${firstToken}`)
      .send({
        totalIncome: 8000,
        allocations: [{ category: "OTHER", limit: 500 }]
      });

    await request(context.app)
      .post("/api/expenses")
      .set("Authorization", `Bearer ${firstToken}`)
      .send({
        category: "OTHER",
        description: "Gift",
        amount: 200,
        spentDate: "2026-05-02"
      });

    const response = await request(context.app)
      .get("/api/overview")
      .set("Authorization", `Bearer ${secondToken}`);

    expect(response.status).toBe(200);
    expect(response.body.summary.totalIncome).toBe(0);
    expect(response.body.summary.totalSpent).toBe(0);
    expect(response.body.activeIncome).toBeNull();
  });

  it("requires authentication", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const response = await request(context.app).get("/api/overview");

    expect(response.status).toBe(401);
  });
});
