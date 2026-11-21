import { describe, expect, it } from "vitest";
import { buildSmartAddSystemPrompt } from "./config/prompts/smart-add.prompt";
import { InMemoryIncomeRepository } from "./modules/income/in-memory-income.repository";
import { SmartAddService } from "./modules/smart-add/smart-add.service";

describe("smart add system prompt", () => {
  it("fills today and the category list, leaving no placeholders", () => {
    const prompt = buildSmartAddSystemPrompt({
      today: "2026-11-21",
      categories: [
        { code: "FOOD", name: "Food" },
        { code: "UTILITIES", name: "Utilities" }
      ]
    });

    expect(prompt).toContain("Today's date is 2026-11-21.");
    expect(prompt).toContain("- FOOD: Food\n- UTILITIES: Utilities");
    expect(prompt).not.toMatch(/\{\{\w+\}\}/);
  });

  it("contains no <placeholders> and only valid JSON example replies using the user's categories", () => {
    const prompt = buildSmartAddSystemPrompt({
      today: "2026-11-21",
      categories: [
        { code: "FOOD", name: "Food" },
        { code: "TRANSPORT", name: "Transport" }
      ]
    });

    expect(prompt).not.toMatch(/<[^>]+>/);

    const replies = prompt
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));

    expect(replies.length).toBeGreaterThan(0);
    for (const reply of replies) {
      expect(["FOOD", "TRANSPORT"]).toContain(reply.category.value);
    }
  });

  it("falls back to one example with a null category when no example fits", () => {
    const prompt = buildSmartAddSystemPrompt({
      today: "2026-11-21",
      categories: [{ code: "RETIREMENT", name: "Retirement" }]
    });

    const replies = prompt
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line));

    expect(replies).toHaveLength(1);
    expect(replies[0].category).toEqual({ value: null, confidence: 0 });
  });
});

describe("SmartAddService.buildMessages", () => {
  it("sends the system prompt with only the given categories, then the user's sentence unchanged", () => {
    const messages = new SmartAddService(new InMemoryIncomeRepository()).buildMessages(
      { userId: "user-1", text: "250 for coffee at Starbucks yesterday", today: "2026-11-21" },
      [
        { code: "FOOD", name: "Food" },
        { code: "DINING_OUT", name: "Dining Out" }
      ]
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("- FOOD: Food\n- DINING_OUT: Dining Out");
    expect(messages[0].content).not.toContain("- SHOPPING:");
    expect(messages[1]).toEqual({ role: "user", content: "250 for coffee at Starbucks yesterday" });
  });
});
