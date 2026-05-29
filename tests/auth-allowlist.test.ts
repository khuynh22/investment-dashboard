import { describe, it, expect } from "vitest";
import { isAllowed } from "@/lib/auth-allowlist";

describe("isAllowed", () => {
  const allowed = "timhuynhwork@gmail.com";
  it("accepts the exact email case-insensitively", () => {
    expect(isAllowed("timhuynhwork@gmail.com", allowed)).toBe(true);
    expect(isAllowed("TimHuynhWork@Gmail.com", allowed)).toBe(true);
  });
  it("rejects other or missing emails", () => {
    expect(isAllowed("someoneelse@gmail.com", allowed)).toBe(false);
    expect(isAllowed(null, allowed)).toBe(false);
    expect(isAllowed("timhuynhwork@gmail.com", undefined)).toBe(false);
  });
});
