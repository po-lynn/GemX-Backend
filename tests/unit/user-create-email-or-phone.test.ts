import { describe, it, expect } from "vitest";
import { userCreateSchema } from "@/features/users/schemas/users";

const BASE = {
  name: "Test User",
  password: "password123",
  role: "user",
};

describe("userCreateSchema — email or phone field", () => {
  it("accepts a valid email address", () => {
    const result = userCreateSchema.safeParse({ ...BASE, email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts a Myanmar phone in 09... format", () => {
    const result = userCreateSchema.safeParse({ ...BASE, email: "09123456789" });
    expect(result.success).toBe(true);
  });

  it("accepts a Myanmar phone in +959... format", () => {
    const result = userCreateSchema.safeParse({ ...BASE, email: "+959123456789" });
    expect(result.success).toBe(true);
  });

  it("rejects a random string that is neither email nor phone", () => {
    const result = userCreateSchema.safeParse({ ...BASE, email: "notavalid" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-Myanmar phone number", () => {
    // +1 area code — not a Myanmar number
    const result = userCreateSchema.safeParse({ ...BASE, email: "+11234567890" });
    expect(result.success).toBe(false);
  });

  it("allows email to be omitted (optional)", () => {
    const result = userCreateSchema.safeParse({ ...BASE });
    // Schema marks it optional; the action enforces presence at runtime
    expect(result.success).toBe(true);
  });
});
