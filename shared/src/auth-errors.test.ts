import { describe, it, expect } from "vitest";
import { describeAuthError } from "./auth-errors.js";

describe("describeAuthError", () => {
  it("returns generic message when err is null/undefined", () => {
    expect(describeAuthError(null)).toEqual({
      message: "Something went wrong. Try again.",
    });
    expect(describeAuthError(undefined)).toEqual({
      message: "Something went wrong. Try again.",
    });
  });

  it("recognizes aborted requests", () => {
    expect(describeAuthError({ isAbort: true })).toEqual({
      message: "Request was cancelled.",
    });
  });

  it("treats status 0 as a connectivity failure", () => {
    expect(describeAuthError({ status: 0 })).toEqual({
      message: "Can't reach the server. Check your connection and try again.",
    });
  });

  it("extracts a single field error from response.data", () => {
    const result = describeAuthError({
      status: 400,
      response: {
        data: { email: { code: "invalid", message: "must be a valid email" } },
      },
    });
    expect(result.fields).toEqual({ email: "must be a valid email" });
    expect(result.message).toBe("Email: must be a valid email");
  });

  it("joins multiple field errors with humanized labels", () => {
    const result = describeAuthError({
      status: 400,
      response: {
        data: {
          email: { message: "is required" },
          password: { message: "is too short" },
        },
      },
    });
    expect(result.fields).toEqual({
      email: "is required",
      password: "is too short",
    });
    expect(result.message).toBe(
      "Email: is required Password: is too short",
    );
  });

  it("humanizes every well-known field name", () => {
    const cases: Array<[string, string]> = [
      ["email", "Email"],
      ["identity", "Email"],
      ["password", "Password"],
      ["passwordConfirm", "Confirm password"],
      ["oldPassword", "Current password"],
      ["name", "Name"],
      ["handle", "Username"],
      ["otp", "Code"],
      ["code", "Code"],
      ["whatever", "Whatever"],
    ];
    for (const [field, label] of cases) {
      const result = describeAuthError({
        status: 400,
        response: { data: { [field]: { message: "bad" } } },
      });
      expect(result.message).toBe(`${label}: bad`);
      expect(result.fields).toEqual({ [field]: "bad" });
    }
  });

  it("ignores field entries with empty messages", () => {
    const result = describeAuthError({
      status: 400,
      message: "Failed to authenticate.",
      response: {
        data: { email: { code: "x", message: "" } },
      },
    });
    expect(result.fields).toBeUndefined();
    expect(result.message).toBe("Wrong email or password.");
  });

  it("400 + signIn + 'Failed to authenticate' → wrong creds", () => {
    expect(
      describeAuthError(
        { status: 400, message: "Failed to authenticate." },
        "signIn",
      ),
    ).toEqual({ message: "Wrong email or password." });
  });

  it("400 + mfa + 'Failed to authenticate' → wrong code", () => {
    expect(
      describeAuthError(
        { status: 400, message: "Failed to authenticate." },
        "mfa",
      ),
    ).toEqual({ message: "That code is wrong or has expired." });
  });

  it("400 + oauth → raw message verbatim", () => {
    expect(
      describeAuthError(
        { status: 400, message: "Provider rejected the token." },
        "oauth",
      ),
    ).toEqual({ message: "Provider rejected the token." });
  });

  it("400 with no usable text falls back to a generic 400 line", () => {
    expect(describeAuthError({ status: 400 }, "signUp")).toEqual({
      message: "The request was rejected.",
    });
  });

  it("401 differentiates signIn vs other contexts", () => {
    expect(describeAuthError({ status: 401 }, "signIn")).toEqual({
      message: "Wrong email or password.",
    });
    expect(describeAuthError({ status: 401 }, "oauth")).toEqual({
      message: "Your session expired. Sign in again.",
    });
  });

  it("403 always returns the disabled-account message", () => {
    expect(describeAuthError({ status: 403 }, "signIn")).toEqual({
      message:
        "This account can't sign in right now. It may be disabled or pending verification.",
    });
  });

  it("404 differentiates signIn vs other contexts", () => {
    expect(describeAuthError({ status: 404 }, "signIn")).toEqual({
      message: "No account matches that email.",
    });
    expect(
      describeAuthError({ status: 404, message: "User not found" }, "oauth"),
    ).toEqual({ message: "User not found" });
    expect(describeAuthError({ status: 404 }, "oauth")).toEqual({
      message: "Not found.",
    });
  });

  it("409 differentiates signUp vs other contexts", () => {
    expect(describeAuthError({ status: 409 }, "signUp")).toEqual({
      message: "An account with that email already exists.",
    });
    expect(
      describeAuthError(
        { status: 409, message: "Handle already taken" },
        "signIn",
      ),
    ).toEqual({ message: "Handle already taken" });
    expect(describeAuthError({ status: 409 }, "signIn")).toEqual({
      message: "That conflicts with existing data.",
    });
  });

  it("429 returns a rate-limit message", () => {
    expect(describeAuthError({ status: 429 })).toEqual({
      message: "Too many attempts. Wait a moment and try again.",
    });
  });

  it("any 5xx returns a server-error message", () => {
    expect(describeAuthError({ status: 500 })).toEqual({
      message: "Server error. Try again in a moment.",
    });
    expect(describeAuthError({ status: 503 })).toEqual({
      message: "Server error. Try again in a moment.",
    });
  });

  it("returns a non-default raw message when status is unknown", () => {
    expect(
      describeAuthError({ message: "Custom backend error" }),
    ).toEqual({ message: "Custom backend error" });
  });

  it("treats a stray 'failed to authenticate.' as the generic fallback", () => {
    expect(
      describeAuthError({ message: "Failed to authenticate." }),
    ).toEqual({ message: "Something went wrong. Try again." });
  });

  it("reads the body off e.data when e.response is absent", () => {
    const result = describeAuthError({
      status: 400,
      data: {
        data: { handle: { message: "already taken" } },
      },
    });
    expect(result.fields).toEqual({ handle: "already taken" });
    expect(result.message).toBe("Username: already taken");
  });
});
