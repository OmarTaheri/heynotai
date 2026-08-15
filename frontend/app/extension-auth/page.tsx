"use client";

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

/**
 * Handoff endpoint for the browser extension. The extension opens this page
 * inside a chrome.identity window and never collects credentials itself, so
 * a visitor without a session is sent to the website's own login modal and
 * bounced straight back here once they're in.
 */
export default function ExtensionAuthPage() {
  const [message, setMessage] = useState("Connecting your extension…");

  useEffect(() => {
    const redirectUri = new URLSearchParams(window.location.search).get("redirect_uri");
    if (!redirectUri) {
      setMessage("The extension supplied an invalid return address.");
      return;
    }
    const toLogin = () => {
      const back = `/extension-auth?redirect_uri=${encodeURIComponent(redirectUri)}`;
      window.location.replace(`/?login=1&next=${encodeURIComponent(back)}`);
    };
    if (!backend.authStore.isValid && !backend.authStore.refreshToken) {
      toLogin();
      return;
    }
    void backend
      .request<{ redirectUrl: string }>("/auth/extension/handoff", {
        method: "POST",
        body: JSON.stringify({ redirectUri }),
      })
      .then(({ redirectUrl }) => window.location.replace(redirectUrl))
      // An expired or revoked website session lands here: send them through
      // the normal login modal rather than asking them to start over.
      .catch(toLogin);
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <p>{message}</p>
    </main>
  );
}
