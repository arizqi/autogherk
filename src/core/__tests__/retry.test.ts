import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../retry.js";

describe("withRetry", () => {
  it("succeeds on first attempt without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce("recovered");

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects maxRetries limit", async () => {
    const transientError = new Error("fetch failed");
    const fn = vi.fn().mockRejectedValue(transientError);

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelay: 1 }),
    ).rejects.toThrow("fetch failed");
    // initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry callback with correct attempt number", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce("done");

    await withRetry(fn, { maxRetries: 3, baseDelay: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
  });

  it("throws final error after all retries exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fetch failed forever"));

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelay: 1 }),
    ).rejects.toThrow("fetch failed forever");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient errors", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Invalid argument"));

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 1 }),
    ).rejects.toThrow("Invalid argument");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on HTTP 429 status errors", async () => {
    const rateLimitError = Object.assign(new Error("rate limited"), {
      status: 429,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce("ok");

    const result = await withRetry(fn, { maxRetries: 2, baseDelay: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on HTTP 503 status errors", async () => {
    const serviceError = Object.assign(new Error("service unavailable"), {
      status: 503,
    });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serviceError)
      .mockResolvedValueOnce("recovered");

    const result = await withRetry(fn, { maxRetries: 2, baseDelay: 1 });
    expect(result).toBe("recovered");
  });
});
