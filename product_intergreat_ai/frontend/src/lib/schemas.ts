import { z } from "zod";

// Mirrors the server password policy (12+ chars, upper, lower, digit); the server stays authoritative.
export const passwordRule = z
  .string()
  .min(12, "At least 12 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a digit");

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(200),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: passwordRule,
});

export const orgSchema = z.object({
  name: z.string().min(2, "At least 2 characters").max(200),
  org_type: z.enum(["external_seller", "b2b_supplier", "b2c_seller"]),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type OrgValues = z.infer<typeof orgSchema>;
