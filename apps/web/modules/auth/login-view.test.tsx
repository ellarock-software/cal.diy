import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import Login from "./login-view";

vi.mock("@calcom/lib/hooks/useLocale", () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@calcom/lib/hooks/useCompatSearchParams", () => ({
  useCompatSearchParams: () => new URLSearchParams(),
}));

vi.mock("@calcom/web/modules/auth/hooks/useLastUsed", () => ({
  useLastUsed: () => [undefined, vi.fn()],
  LastUsed: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@components/AddToHomescreen", () => ({
  default: () => null,
}));

vi.mock("@components/auth/TwoFactor", () => ({
  default: () => null,
}));

vi.mock("@components/auth/BackupCode", () => ({
  default: () => null,
}));

describe("Login view - Forgot password link", () => {
  const defaultProps = {
    csrfToken: "test-csrf-token",
    isGoogleLoginEnabled: false,
    isOutlookLoginEnabled: false,
    totpEmail: null,
  } as React.ComponentProps<typeof Login>;

  it("renders the Forgot? link pointing at /auth/forgot-password", () => {
    render(<Login {...defaultProps} />);

    const forgotLink = screen.getByRole("link", { name: "forgot" });
    expect(forgotLink).toHaveAttribute("href", "/auth/forgot-password");
    expect(forgotLink).not.toHaveAttribute("href", "#");
  });
});
