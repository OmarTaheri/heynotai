"use client";

import { type FormEvent, useState } from "react";
import { Button } from "../Button";
import { useAuth } from "@/lib/auth";
import { Divider, Field, FormError, PasswordField } from "./AuthFields";
import { OAuthButtons } from "./OAuthButtons";

export function SignupForm({
  onSwitchMode,
  onAuthenticated,
}: {
  onSwitchMode: () => void;
  onAuthenticated?: () => void;
}) {
  const { signUp, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signUp(name, email, password);
    if (result.ok) {
      onAuthenticated?.();
    } else if ("mfaRequired" in result) {
      setError("Unexpected MFA challenge during signup.");
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
        Create your account
      </h2>
      <p className="mt-1.5 text-center text-[13px] text-[var(--color-fg-mid)]">
        Start catching AI across text, image, audio, and video.
      </p>

      <OAuthButtons className="mt-6" onGoogle={handleGoogle} disabled={submitting} />

      <Divider className="my-5">or sign up with email</Divider>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Field
          label="Full name"
          type="text"
          name="name"
          required
          placeholder="Jane Cooper"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="flex items-start gap-2.5 pt-1 text-[12px] text-[var(--color-fg-mid)]">
          <input
            type="checkbox"
            required
            className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 cursor-pointer accent-[var(--color-cta)]"
          />
          <span>
            I agree to heynotai&apos;s{" "}
            <a
              href="#terms"
              className="text-[var(--color-fg)] underline-offset-2 hover:underline"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="#privacy"
              className="text-[var(--color-fg)] underline-offset-2 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {error && <FormError>{error}</FormError>}

        <Button
          type="submit"
          variant="green"
          size="lg"
          fullWidth
          disabled={submitting}
        >
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-[var(--color-fg-mid)]">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          className="font-medium text-[var(--color-fg)] underline-offset-2 hover:underline"
        >
          Log in
        </button>
      </p>
    </>
  );
}
