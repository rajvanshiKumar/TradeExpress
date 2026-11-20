import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./schemas";

describe("registerSchema", () => {
  const ok = { full_name: "Asha", email: "a@b.co", password: "Str0ng-enough-pw" };
  it("accepts a valid payload", () => expect(registerSchema.safeParse(ok).success).toBe(true));
  it("rejects weak passwords like the server does", () => {
    for (const password of ["short1A", "alllowercaseletters1", "NOLOWERCASE12345", "NoDigitsHereAtAll"]) {
      expect(registerSchema.safeParse({ ...ok, password }).success).toBe(false);
    }
  });
  it("rejects bad email", () => expect(registerSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false));
});

describe("loginSchema", () => {
  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});
