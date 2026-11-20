"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from "@/lib/schemas";
import { Button, Field } from "./ui";

export function LoginForm({ onSubmit }: { onSubmit: (v: LoginValues) => Promise<void> | void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setServerError(null);
        try {
          await onSubmit(v);
        } catch (e) {
          setServerError(e instanceof Error ? e.message : "Sign in failed");
        }
      })}
    >
      <Field id="email" label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
      <Field id="password" label="Password" type="password" autoComplete="current-password" error={formState.errors.password?.message} {...register("password")} />
      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" loading={formState.isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

export function RegisterForm({ onSubmit }: { onSubmit: (v: RegisterValues) => Promise<void> | void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async (v) => {
        setServerError(null);
        try {
          await onSubmit(v);
        } catch (e) {
          setServerError(e instanceof Error ? e.message : "Registration failed");
        }
      })}
    >
      <Field id="full_name" label="Full name" autoComplete="name" error={formState.errors.full_name?.message} {...register("full_name")} />
      <Field id="email" label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
      <Field id="password" label="Password" type="password" autoComplete="new-password" error={formState.errors.password?.message} {...register("password")} />
      <p className="text-xs text-slate-500">12+ characters with upper-case, lower-case and a digit.</p>
      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError}
        </p>
      )}
      <Button type="submit" className="w-full" loading={formState.isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
