// User-facing messages for PocketBase auth failures.
//
// PB's default `Failed to authenticate.` is what every wrong-password,
// banned-account, or rate-limited request gets reduced to in the UI.
// This helper unpacks `status`, network failures, and the per-field
// validation map (`response.data`) so the form can show something the
// user can act on.

export type AuthErrorContext = "signIn" | "signUp" | "oauth" | "mfa";

type FieldErr = { code?: string; message?: string };
type PbBody = {
  code?: number;
  message?: string;
  data?: Record<string, FieldErr>;
};
type PbErrorShape = {
  status?: number;
  message?: string;
  isAbort?: boolean;
  originalError?: unknown;
  response?: PbBody;
  data?: PbBody;
};

export type AuthErrorInfo = {
  /** Single sentence safe to render in a toast or inline banner. */
  message: string;
  /** Field → message map, when PB returned per-field validation errors. */
  fields?: Record<string, string>;
};

export function describeAuthError(
  err: unknown,
  ctx: AuthErrorContext = "signIn",
): AuthErrorInfo {
  if (!err) return { message: "Something went wrong. Try again." };
  const e = err as PbErrorShape;

  if (e.isAbort) return { message: "Request was cancelled." };

  const status = typeof e.status === "number" ? e.status : undefined;

  // status 0 in PocketBase's SDK means the request never reached the
  // server — DNS, offline, CORS, or mixed-content blocked it.
  if (status === 0) {
    return {
      message:
        "Can't reach the server. Check your connection and try again.",
    };
  }

  const body = e.response ?? e.data ?? {};
  const rawMsg = (e.message ?? body.message ?? "").trim();

  const fieldEntries = body.data && typeof body.data === "object"
    ? Object.entries(body.data).filter(
        ([, v]) => v && typeof v === "object" && typeof v.message === "string",
      )
    : [];

  if (fieldEntries.length > 0) {
    const fields: Record<string, string> = {};
    const sentences: string[] = [];
    for (const [name, fe] of fieldEntries) {
      const msg = fe.message ?? "";
      if (!msg) continue;
      fields[name] = msg;
      sentences.push(`${humanizeField(name)}: ${msg}`);
    }
    if (sentences.length > 0) {
      return { message: sentences.join(" "), fields };
    }
  }

  if (status === 400) {
    if (ctx === "signIn" && /failed to authenticate/i.test(rawMsg)) {
      return { message: "Wrong email or password." };
    }
    if (ctx === "mfa" && /failed to authenticate/i.test(rawMsg)) {
      return { message: "That code is wrong or has expired." };
    }
    return { message: rawMsg || "The request was rejected." };
  }
  if (status === 401) {
    return ctx === "signIn"
      ? { message: "Wrong email or password." }
      : { message: "Your session expired. Sign in again." };
  }
  if (status === 403) {
    return {
      message:
        "This account can't sign in right now. It may be disabled or pending verification.",
    };
  }
  if (status === 404) {
    return ctx === "signIn"
      ? { message: "No account matches that email." }
      : { message: rawMsg || "Not found." };
  }
  if (status === 409) {
    return ctx === "signUp"
      ? { message: "An account with that email already exists." }
      : { message: rawMsg || "That conflicts with existing data." };
  }
  if (status === 429) {
    return { message: "Too many attempts. Wait a moment and try again." };
  }
  if (typeof status === "number" && status >= 500) {
    return { message: "Server error. Try again in a moment." };
  }

  if (rawMsg && rawMsg.toLowerCase() !== "failed to authenticate.") {
    return { message: rawMsg };
  }
  return { message: "Something went wrong. Try again." };
}

function humanizeField(name: string): string {
  switch (name) {
    case "email":
    case "identity":
      return "Email";
    case "password":
      return "Password";
    case "passwordConfirm":
      return "Confirm password";
    case "oldPassword":
      return "Current password";
    case "name":
      return "Name";
    case "handle":
      return "Username";
    case "otp":
    case "code":
      return "Code";
    default:
      return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
