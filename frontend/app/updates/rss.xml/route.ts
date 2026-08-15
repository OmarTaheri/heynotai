const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://heynotai.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Public changelog feed, served from the same `updates` collection the
 *  /app/updates page renders. Added so the page's "Subscribe to RSS"
 *  buttons point at something real — they previously had no handler and
 *  no feed existed. */
export const revalidate = 900;

type UpdateRow = {
  id: string;
  slug?: string;
  title?: string;
  description?: string;
  kind?: string;
  publishedAt?: string;
  timestamp?: string;
  ctaHref?: string;
};

/** XML text escaping. Titles carry literal `<em>` markup for the page's
 *  typography, so tags are stripped before escaping rather than passed
 *  through into the feed. */
function xmlText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pubDate(row: UpdateRow): string {
  const raw = row.publishedAt || row.timestamp;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toUTCString()
    : new Date(0).toUTCString();
}

export async function GET(): Promise<Response> {
  let items: UpdateRow[] = [];
  try {
    const res = await fetch(`${API_URL}/updates?limit=50`, {
      next: { revalidate },
    });
    if (res.ok) {
      const body = (await res.json()) as { items?: UpdateRow[] };
      items = body.items ?? [];
    }
  } catch {
    // Feed readers handle an empty channel fine; a 500 would get the
    // feed unsubscribed by some clients.
  }

  const entries = items
    .map((row) => {
      const link = row.ctaHref?.startsWith("http")
        ? row.ctaHref
        : `${SITE_URL}/app/updates#${row.slug || row.id}`;
      return [
        "    <item>",
        `      <title>${xmlText(row.title)}</title>`,
        `      <link>${xmlText(link)}</link>`,
        `      <guid isPermaLink="false">${xmlText(row.slug || row.id)}</guid>`,
        `      <pubDate>${pubDate(row)}</pubDate>`,
        row.kind ? `      <category>${xmlText(row.kind)}</category>` : "",
        `      <description>${xmlText(row.description)}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>heynotai — product updates</title>",
    `    <link>${SITE_URL}/app/updates</link>`,
    "    <description>New model support, accuracy improvements, and product changes.</description>",
    "    <language>en</language>",
    `    <atom:link href="${SITE_URL}/updates/rss.xml" rel="self" type="application/rss+xml" />`,
    entries,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
