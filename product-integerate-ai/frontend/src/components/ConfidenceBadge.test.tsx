import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceBadge } from "./ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("shows percentage and routing label", () => {
    render(<ConfidenceBadge confidence={0.954} routing="prefill" />);
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });
  it("marks empty predictions as not detected", () => {
    render(<ConfidenceBadge confidence={0.2} routing="empty" />);
    expect(screen.getByText(/not detected/i)).toBeInTheDocument();
  });
});
