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

describe("personalization rule catalog", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  it("requires authentication", async () => {
    const context = buildTestContext();
    contexts.push(context);

    const response = await request(context.app).get("/api/personalization/rule-catalog");
    expect(response.status).toBe(401);
  });

  it("returns all three rules with their bucket percentages", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "catalog-rules@example.com");

    const response = await request(context.app)
      .get("/api/personalization/rule-catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.rules).toEqual([
      { code: "50/30/20", buckets: { needs: 50, wants: 30, saveInvest: 20 } },
      { code: "60/20/20", buckets: { needs: 60, wants: 20, saveInvest: 20 } },
      { code: "70/20/10", buckets: { needs: 70, wants: 20, saveInvest: 10 } }
    ]);
  });

  it("returns three buckets whose category weights each sum to 100", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "catalog-buckets@example.com");

    const response = await request(context.app)
      .get("/api/personalization/rule-catalog")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.buckets).sort()).toEqual(["needs", "saveInvest", "wants"]);

    for (const bucketKey of ["needs", "wants", "saveInvest"] as const) {
      const bucket = response.body.buckets[bucketKey];
      expect(bucket.name).toBeTruthy();
      expect(Array.isArray(bucket.categories)).toBe(true);
      const total = bucket.categories.reduce(
        (sum: number, category: { weight: number }) => sum + category.weight,
        0
      );
      expect(total).toBe(100);
      for (const category of bucket.categories) {
        expect(category.code).toMatch(/^[A-Za-z_]+$/);
        expect(category.name).toBeTruthy();
        expect(category.weight).toBeGreaterThan(0);
      }
    }
  });

  it("includes the expected anchor codes in each bucket", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "catalog-codes@example.com");

    const response = await request(context.app)
      .get("/api/personalization/rule-catalog")
      .set("Authorization", `Bearer ${token}`);

    const codesIn = (bucketKey: "needs" | "wants" | "saveInvest") =>
      response.body.buckets[bucketKey].categories.map((category: { code: string }) => category.code);

    expect(codesIn("needs")).toEqual(
      expect.arrayContaining(["HOUSING", "EMI_LOAN", "GROCERIES", "INSURANCE"])
    );
    expect(codesIn("wants")).toEqual(
      expect.arrayContaining(["DINING_OUT", "ENTERTAINMENT", "SUBSCRIPTIONS"])
    );
    expect(codesIn("saveInvest")).toEqual(
      expect.arrayContaining(["EMERGENCY_FUND", "RETIREMENT", "DEBT_PREPAYMENT"])
    );
  });
});

describe("income categories union list", () => {
  const contexts: Array<ReturnType<typeof buildTestContext>> = [];

  afterEach(async () => {
    for (const context of contexts.splice(0)) {
      await context.close();
    }
  });

  it("exposes legacy codes alongside the new personalization codes", async () => {
    const context = buildTestContext();
    contexts.push(context);
    const token = await signupAndGetToken(context.app, "income-categories@example.com");

    const response = await request(context.app)
      .get("/api/income/categories")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const codes = response.body.categories.map((category: { code: string }) => category.code);

    // legacy codes still present
    expect(codes).toEqual(
      expect.arrayContaining(["HOUSING", "FOOD", "EDUCATION", "Loans", "OTHER"])
    );

    // new codes added by Stage 2
    expect(codes).toEqual(
      expect.arrayContaining([
        "GROCERIES",
        "EMI_LOAN",
        "INSURANCE",
        "EDUCATION_KIDS",
        "CHILDCARE",
        "DINING_OUT",
        "SUBSCRIPTIONS",
        "SHOPPING",
        "TRAVEL",
        "HOBBIES",
        "PERSONAL_CARE",
        "SELF_DEVELOPMENT",
        "EMERGENCY_FUND",
        "RETIREMENT",
        "DEBT_PREPAYMENT",
        "GOAL_SAVINGS"
      ])
    );
  });
});
