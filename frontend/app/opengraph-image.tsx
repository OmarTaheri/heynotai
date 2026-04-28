import { ImageResponse } from "next/og";

export const alt =
  "heynotai — More than detecting AI. Safeguarding what makes us human.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "linear-gradient(135deg, #0b0c0f 0%, #131722 60%, #0b0c0f 100%)",
          color: "#e8e8ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            letterSpacing: "-0.01em",
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background:
                "linear-gradient(135deg, oklch(0.55 0.2 250) 0%, oklch(0.6 0.18 235) 100%)",
              display: "flex",
            }}
          />
          heynotai
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            More than detecting AI. Safeguarding what makes us human.
          </div>
          <div
            style={{
              fontSize: 26,
              color: "#b3b6c2",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            Real-time AI-generated content detector for text, audio, and
            video.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 18,
            color: "#8a8d99",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>heynotai.com</span>
          <span>text · image · audio · video</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
