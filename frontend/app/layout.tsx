import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

/**
 * Self-hosted font loading via next/font.
 *
 * Each font is exposed as a CSS custom property and consumed by
 * globals.css's `--font-sans` / `--font-mono` design tokens.
 * Self-hosting eliminates the third-party font request, prevents
 * flash-of-unstyled-text, and lets next/font subset the file to just
 * the glyphs we actually use.
 *
 * Two fonts cover the whole product (marketing, dashboard, extension):
 *   - Inter           — UI prose, controls, body, headings
 *   - JetBrains Mono  — tabular numbers, kbd, code-style metadata
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "heynotai — More than detecting AI. Safeguarding what makes us human.",
  description:
    "Real-time AI-generated content detector for text, audio, and video. Verify authenticity of academic, professional, and creative work.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0c0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      // The extension's content script stamps `data-heynotai-extension`
      // and `-id` on the document root at `document_idle`, which can land
      // before React hydrates — the server HTML has neither attribute, so
      // hydration reports a mismatch on every page load in a browser that
      // has the extension installed. Suppression here applies only to this
      // element's own attributes, not to anything under <body>.
      suppressHydrationWarning
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
