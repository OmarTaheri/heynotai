import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | heynotai",
  description: "How heynotai collects, uses, stores, and shares information.",
};

const sectionStyle = "space-y-3";
const headingStyle = "text-xl font-semibold text-white";
const textStyle = "text-sm leading-7 text-zinc-300";

/** Mirrors the data-type disclosures selected in the Chrome Web Store
 *  listing. The store makes you certify that the dashboard answers match
 *  this page, so the two lists have to be changed together. */
const collected: { label: string; detail: string }[] = [
  {
    label: "Account information",
    detail:
      "your name, email address, account ID, sign-in provider, and the session tokens that keep you signed in.",
  },
  {
    label: "Content you ask us to check",
    detail:
      "the text you highlight, the image or video you submit, and the page URL and title of the item being checked.",
  },
  {
    label: "Check history and preferences",
    detail:
      "the result, confidence score, and timestamp of each check you run, plus the settings you choose in the extension.",
  },
  {
    label: "Security and diagnostic information",
    detail:
      "the IP address and browser user agent recorded with each sign-in session, and error diagnostics when a check fails.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0b0c0f] px-6 py-14 text-white">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-4 border-b border-white/10 pb-8">
          <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
            ← Back to heynotai
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-zinc-400">Last updated: August 15, 2026</p>
          <p className={textStyle}>
            This policy explains how heynotai ("we", "us", or "our") handles
            information when you use our website, browser extension, and detection services.
          </p>
        </header>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Information we collect</h2>
          <p className={textStyle}>
            We collect four kinds of information, and nothing beyond what the service needs
            to return a detection result to you:
          </p>
          <ul className="space-y-2">
            {collected.map((item) => (
              <li key={item.label} className={`${textStyle} flex gap-3`}>
                <span aria-hidden className="text-emerald-400">
                  •
                </span>
                <span>
                  <strong className="font-medium text-white">{item.label}</strong> —{" "}
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
          <p className={textStyle}>
            Content is processed when you start a check, or on the platforms you have
            explicitly enabled for automatic detection. We do not collect your general
            browsing history, we do not log your clicks, scrolling, or keystrokes, and we do
            not read pages you have not asked us to check.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>How we use information</h2>
          <p className={textStyle}>
            We use information only to provide and improve detection, authenticate accounts,
            synchronize settings and history, secure the service, troubleshoot failures, and
            respond to support requests. We do not sell personal information, use it for
            advertising, or use it for credit or lending decisions.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Browser extension data</h2>
          <p className={textStyle}>
            The extension stores preferences, authentication state, and recent scan state in
            Chrome storage. It reads supported content on pages you choose to scan, or on pages
            covered by automatic detection settings you enable. Scan content is sent securely
            to the heynotai API to return a result. The extension does not execute remotely
            hosted code.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Service providers and sharing</h2>
          <p className={textStyle}>
            We share information only with infrastructure and model providers that help operate
            the service, and only as needed to provide the requested functionality. Google
            receives information when you choose Google sign-in. We may also disclose
            information when legally required or to protect users and the service.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Storage, retention, and security</h2>
          <p className={textStyle}>
            Account and scan data may be stored in our databases, while extension preferences
            and authentication state are stored locally in Chrome. We keep information only as
            long as necessary to provide the service, meet legal obligations, resolve disputes,
            and protect the service. We use reasonable technical and organizational safeguards,
            but no system can guarantee absolute security.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Your choices</h2>
          <p className={textStyle}>
            You can disable automatic detection, clear local extension data by removing the
            extension, delete individual scans in the application, or request account and data
            deletion by contacting us. You may also revoke Google access from your Google
            Account settings.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Google API Limited Use</h2>
          <p className={textStyle}>
            The use of information received from Google APIs will adhere to the Chrome Web Store
            User Data Policy, including the Limited Use requirements.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Children and international use</h2>
          <p className={textStyle}>
            heynotai is not directed to children under 13. If you use the service outside the
            country where our systems operate, your information may be processed across borders
            under applicable law.
          </p>
        </section>

        <section className={sectionStyle}>
          <h2 className={headingStyle}>Changes and contact</h2>
          <p className={textStyle}>
            We may update this policy and will post the revised date here. For privacy requests
            or questions, email{" "}
            <a className="text-emerald-400 hover:text-emerald-300" href="mailto:support@heynotai.io">
              support@heynotai.io
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
