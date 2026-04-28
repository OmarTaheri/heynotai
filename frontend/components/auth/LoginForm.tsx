"use client";

import { type FormEvent, useState } from "react";
import { Button } from "../Button";
import { useAuth } from "@/lib/auth";
import {
  Divider,
  Field,
  FormError,
  PasswordField,
} from "./AuthFields";
import { OAuthButtons } from "./OAuthButtons";

export function LoginForm({
  onSwitchMode,
  onAuthenticated,
}: {
  onSwitchMode: () => void;
  onAuthenticated?: () => void;
}) {
  const { signIn, signInWithGoogle, confirmMfa } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfa, setMfa] = useState<{ mfaId: string; otpId: string } | null>(null);
  const [otp, setOtp] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mfa) {
      const result = await confirmMfa(mfa.mfaId, mfa.otpId, otp);
      if (result.ok) onAuthenticated?.();
      else if ("error" in result) setError(result.error);
      setSubmitting(false);
      return;
    }

    const result = await signIn(email, password);
    if (result.ok) {
      onAuthenticated?.();
    } else if ("mfaRequired" in result) {
      setMfa({ mfaId: result.mfaId, otpId: result.otpId });
      setSubmitting(false);
    } else {
      setError(result.error);
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    const result = await signInWithGoogle();
    if (result.ok) onAuthenticated?.();
    else if ("error" in result) setError(result.error);
    setSubmitting(false);
  };

  return (
    <>
      <h2
        id="auth-title"
        className="mt-5 text-center text-[22px] font-semibold tracking-tight text-[var(--color-fg)]"
      >
        Welcome back
      </h2>
      <p className="mt-1.5 text-center text-[13px] text-[var(--color-fg-mid)]">
        Log in to keep AI out of what you read.
      </p>

      <OAuthButtons className="mt-6" onGoogle={handleGoogle} disabled={submitting} />

      <Divider className="my-5">or continue with email</Divider>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {!mfa && (
          <>
            <Field
              label="Email"
              type="email"
              name="email"
              required
              placeholder="you@domain.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordField
              label="Password"
              name="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            >
              <button
                type="button"
                className="text-[12px] font-medium text-[var(--color-accent-ink)] hover:text-white"
              >
                Forgot?
              </button>
            </PasswordField>
          </>
        )}

        {mfa && (
          <Field
            label="Verification code"
            type="text"
            name="otp"
            required
            inputMode="numeric"
            placeholder="123456"
            autoComplete="one-time-code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            hint="Enter the 6-digit code from your authenticator app or email."
          />
        )}

        {error && <FormError>{error}</FormError>}

        <Button
          type="submit"
          variant="green"
          size="lg"
          fullWidth
          disabled={submitting}
        >
          {submitting
            ? mfa
              ? "Verifying…"
              : "Logging in…"
            : mfa
              ? "Verify"
              : "Log in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-[12.5px] text-[var(--color-fg-mid)]">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-medium text-[var(--color-fg)] underline-offset-2 hover:underline"
        >
          Create one
        </button>
      </p>
    </>
  );
}
