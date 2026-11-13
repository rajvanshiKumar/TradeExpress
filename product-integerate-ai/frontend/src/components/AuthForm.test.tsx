import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "./AuthForms";

describe("LoginForm", () => {
  it("shows validation errors and does not submit invalid data", async () => {
    const onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findAllByRole("alert")).not.toHaveLength(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits valid credentials", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.co");
    await userEvent.type(screen.getByLabelText(/password/i), "Str0ng-enough-pw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.co", password: "Str0ng-enough-pw" }));
  });

  it("surfaces a server error message", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Invalid email or password"));
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText(/email/i), "a@b.co");
    await userEvent.type(screen.getByLabelText(/password/i), "whatever");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });
});
