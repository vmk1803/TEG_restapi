import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryIncomeRepository } from "./modules/income/in-memory-income.repository";
import { SmartAddService } from "./modules/smart-add/smart-add.service";

const GROQ = { apiKey: "test-key", apiUrl: "https://groq.test/chat", model: "test-model" };
const INPUT = { userId: "user-1", text: "two fifty for auto yesterday", today: "2026-11-21" };

const EMPTY = {
  rawText: INPUT.text,
  amount: { value: null, confidence: 0 },
  spentDate: { value: null, confidence: 0 },
  category: { value: null, confidence: 0 },
  description: { value: null, confidence: 0 }
};

const VALID_REPLY = {
  amount: { value: 250, confidence: 0.9 },
  spentDate: { value: "2026-11-20", confidence: 0.95 },
  category: { value: "TRANSPORT", confidence: 0.85 },
  description: { value: "Auto ride", confidence: 0.8 }
};

/** Groq's 400 when the model's own output fails its JSON-mode check. */
function groqJsonValidateFailed() {
  return new Response(
    JSON.stringify({
      error: {
        message: "Failed to validate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
        type: "invalid_request_error",
        code: "json_validate_failed",
        failed_generation: ""
      }
    }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

/** A Groq chat completions response whose message content is `content`. */
function groqResponse(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/** An income repository where user-1's budget covers TRANSPORT and FOOD only. */
async function repositoryWithPlan() {
  const repository = new InMemoryIncomeRepository();
  await repository.create({
    id: "income-1",
    userId: INPUT.userId,
    totalIncome: 50000,
    allocations: [
      { category: "TRANSPORT", limit: 3000 },
      { category: "FOOD", limit: 8000 }
    ],
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z"
  });
  return repository;
}

describe("SmartAddService.parseExpense", () => {
  const fetchMock = vi.fn();
  let incomeRepository: InMemoryIncomeRepository;
  let service: SmartAddService;

  beforeEach(async () => {
    incomeRepository = await repositoryWithPlan();
    service = new SmartAddService(incomeRepository, GROQ);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps a valid reply to the parsed result", async () => {
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(VALID_REPLY)));

    const result = await service.parseExpense(INPUT);

    expect(result).toEqual({ rawText: INPUT.text, ...VALID_REPLY });
  });

  it("sends the built messages to Groq in JSON mode", async () => {
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(VALID_REPLY)));
    await service.parseExpense(INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GROQ.apiUrl);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toEqual(service.buildMessages(INPUT, await service.getUserCategories(INPUT.userId)));
  });

  it("drops an unknown category but keeps the other fields", async () => {
    const reply = { ...VALID_REPLY, category: { value: "AUTO_RICKSHAW", confidence: 0.9 } };
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(reply)));

    const result = await service.parseExpense(INPUT);

    expect(result.category).toEqual({ value: null, confidence: 0 });
    expect(result.amount).toEqual(VALID_REPLY.amount);
    expect(result.description).toEqual(VALID_REPLY.description);
  });

  it("drops a date after today", async () => {
    const reply = { ...VALID_REPLY, spentDate: { value: "2026-11-22", confidence: 0.9 } };
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(reply)));

    const result = await service.parseExpense(INPUT);

    expect(result.spentDate).toEqual({ value: null, confidence: 0 });
  });

  it("sets an out-of-range confidence to 0 and a null value's confidence to 0", async () => {
    const reply = {
      ...VALID_REPLY,
      amount: { value: 250, confidence: 7 },
      description: { value: null, confidence: 0.6 }
    };
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(reply)));

    const result = await service.parseExpense(INPUT);

    expect(result.amount).toEqual({ value: 250, confidence: 0 });
    expect(result.description).toEqual({ value: null, confidence: 0 });
  });

  it("returns the empty result when the reply is not JSON", async () => {
    fetchMock.mockResolvedValue(groqResponse("Sure! Here is the expense: 250"));

    expect(await service.parseExpense(INPUT)).toEqual(EMPTY);
  });

  it.each([401, 429, 500])("returns the empty result on HTTP %i", async (status) => {
    fetchMock.mockResolvedValue(new Response("error", { status }));

    expect(await service.parseExpense(INPUT)).toEqual(EMPTY);
    expect(fetchMock).toHaveBeenCalledTimes(1); // only json_validate_failed is retried
    expect(console.error).toHaveBeenCalledWith(
      "[smart-add] Groq parse failed:",
      expect.stringContaining(`Groq request failed: ${status}`)
    );
  });

  it("returns the empty result when the request fails or times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    expect(await service.parseExpense(INPUT)).toEqual(EMPTY);
  });

  it("returns the empty result without calling Groq when no key is configured", async () => {
    expect(await new SmartAddService(incomeRepository, null).parseExpense(INPUT)).toEqual(EMPTY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists only the user's budget categories in the prompt", async () => {
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(VALID_REPLY)));

    await service.parseExpense(INPUT);

    const systemPrompt: string = JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content;
    expect(systemPrompt).toContain("- FOOD: Food");
    expect(systemPrompt).toContain("- TRANSPORT: Transport");
    expect(systemPrompt).not.toContain("- SHOPPING:");
  });

  it("drops a valid category that is not in the user's budget", async () => {
    const reply = { ...VALID_REPLY, category: { value: "SHOPPING", confidence: 0.85 } };
    fetchMock.mockResolvedValue(groqResponse(JSON.stringify(reply)));

    const result = await service.parseExpense(INPUT);

    expect(result.category).toEqual({ value: null, confidence: 0 });
    expect(result.amount).toEqual(VALID_REPLY.amount);
    expect(result.description).toEqual(VALID_REPLY.description);
  });

  it("returns the empty result without calling Groq when the user has no budget", async () => {
    const result = await service.parseExpense({ ...INPUT, userId: "user-without-plan" });

    expect(result).toEqual(EMPTY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once when Groq rejects the model's JSON, and uses the retry's reply", async () => {
    fetchMock
      .mockResolvedValueOnce(groqJsonValidateFailed())
      .mockResolvedValueOnce(groqResponse(JSON.stringify(VALID_REPLY)));

    const result = await service.parseExpense(INPUT);

    expect(result).toEqual({ rawText: INPUT.text, ...VALID_REPLY });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
    expect(console.warn).toHaveBeenCalledWith("[smart-add] Groq returned invalid JSON, retrying once");
  });

  it("returns the empty result when the retry also fails", async () => {
    fetchMock.mockImplementation(async () => groqJsonValidateFailed());

    expect(await service.parseExpense(INPUT)).toEqual(EMPTY);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      "[smart-add] Groq parse failed:",
      expect.stringContaining("json_validate_failed")
    );
  });
});
