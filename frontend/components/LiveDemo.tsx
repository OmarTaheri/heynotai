"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./LiveDemo.module.css";

type DemoId = "text" | "image" | "audio" | "video" | "extension";
type DemoEntry = { id: DemoId; label: string; icon: IconName };

const DETECTORS: DemoEntry[] = [
  { id: "text", label: "Text", icon: "text" },
  { id: "image", label: "Image", icon: "image" },
  { id: "audio", label: "Audio", icon: "audio" },
  { id: "video", label: "Video", icon: "video" },
];

const SURFACES: DemoEntry[] = [
  { id: "extension", label: "Browser extension", icon: "puzzle" },
];

const HEAD_TITLE: Record<DemoId, string> = {
  text: "Catches AI in the prose, sentence by sentence",
  image: "Spots AI in pixels — and tells you which region",
  audio: "Hears synthetic voice in the spectral fingerprint",
  video: "Catches deepfakes frame by frame",
  extension: "Lives in your browser, watches every page",
};

const HEAD_META: Record<DemoId, string> = {
  text: "4 models · word-level highlighting",
  image: "Region localization · 0.4 MP/s",
  audio: "Spectral · prosody · TTS profile match",
  video: "Frame-level · face-swap detection",
  extension: "MV3 extension · live verdict overlay",
};

export function LiveDemo() {
  const [active, setActive] = useState<DemoId>("image");

  return (
    <section className={styles.section} id="demo">
      <div className={styles.wrap}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>
            <FourPointSparkle size={11} />
            Live preview
          </span>
          <h2 className={styles.title}>
            One detector. <span className={styles.dim}>Every kind of</span> AI.
          </h2>
          <p className={styles.sub}>
            Switch surfaces below — text, image, audio, video, or the
            extension — and see exactly what the verdict looks like in
            context.
          </p>
        </div>

        <div className={styles.shell}>
          <aside className={styles.side}>
            <div className={styles.groupLabel}>Detectors</div>
            {DETECTORS.map((d) => (
              <DemoTab
                key={d.id}
                entry={d}
                active={active === d.id}
                onClick={() => setActive(d.id)}
              />
            ))}
            <div className={styles.groupLabel}>Surfaces</div>
            {SURFACES.map((d) => (
              <DemoTab
                key={d.id}
                entry={d}
                active={active === d.id}
                onClick={() => setActive(d.id)}
              />
            ))}
          </aside>

          <div className={styles.stage}>
            <div className={styles.stageHead}>
              <h4>{HEAD_TITLE[active]}</h4>
              <div className={styles.stageMeta}>
                <span className={styles.liveDot} />
                {HEAD_META[active]}
              </div>
            </div>
            {active === "text" && <TextDemo />}
            {active === "image" && <ImageDemo />}
            {active === "audio" && <AudioDemo />}
            {active === "video" && <VideoDemo />}
            {active === "extension" && <ExtensionDemo />}
          </div>
        </div>
      </div>
    </section>
  );
}

function DemoTab({
  entry,
  active,
  onClick,
}: {
  entry: DemoEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.tab} ${active ? styles.tabActive : ""}`}
    >
      <Icon name={entry.icon} size={16} />
      {entry.label}
      <span className={styles.tabDot} />
    </button>
  );
}

function ScoreRing({ value, color }: { value: number; color?: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const stroke = color ?? "var(--color-ai)";
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 56 56">
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--color-surface-alt)"
          strokeWidth="4"
        />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div className={styles.ringNum}>{value}%</div>
    </div>
  );
}

type VerdictKind = "ai" | "human" | "mixed";
function VerdictPill({
  kind,
  small,
  children,
}: {
  kind: VerdictKind;
  small?: boolean;
  children: ReactNode;
}) {
  const cls = kind === "ai" ? styles.verdict_ai : kind === "human" ? styles.verdict_human : styles.verdict_mixed;
  return (
    <span className={`${styles.verdict} ${cls} ${small ? styles.verdictSm : ""}`}>
      <span className={styles.verdictDot} />
      {children}
    </span>
  );
}

function ScoreReadout({
  value,
  color,
  top,
  bot,
  badge,
}: {
  value?: number;
  color?: string;
  top: string;
  bot: string;
  badge?: ReactNode;
}) {
  return (
    <div className={styles.readout}>
      {value !== undefined && <ScoreRing value={value} color={color} />}
      <div className={styles.readoutText}>
        <div className={styles.readoutTop}>{top}</div>
        <div className={styles.readoutBot}>{bot}</div>
      </div>
      {badge}
    </div>
  );
}

function TextDemo() {
  return (
    <div className={styles.canvas}>
      <div className={styles.textBlock}>
        <span className={styles.humanSpan}>
          &ldquo;I went down to the river last weekend with my dad,&rdquo; she
          wrote. &ldquo;We didn&apos;t catch anything, but the wind was warm
          and we ate sandwiches under the bridge.&rdquo;{" "}
        </span>
        <span className={styles.aiSpan}>
          In recent years, the rapid advancement of artificial intelligence
          has fundamentally transformed how we approach the act of
          remembering —{" "}
        </span>
        <span className={styles.aiSpan}>
          a paradigm shift that promises to revolutionize the very fabric of
          personal narrative.
        </span>
        <span className={styles.humanSpan}>
          {" "}
          Anyway, that&apos;s all I wanted to say.
        </span>
      </div>
      <ScoreReadout
        value={64}
        top="AI-generated content detected"
        bot="2 of 4 sentences flagged · agreement across 4 models"
        badge={<VerdictPill kind="ai">Likely AI</VerdictPill>}
      />
    </div>
  );
}

function ImageDemo() {
  return (
    <div className={styles.canvas}>
      <div className={styles.imgGrid}>
        <div className={styles.imgTile}>
          <div className={styles.imgPh} />
          <div className={styles.imgScan} />
          <div className={styles.imgCorner}>
            <VerdictPill kind="ai" small>
              AI
            </VerdictPill>
          </div>
          <div className={styles.imgLabel}>portrait_03.png</div>
          <div
            className={styles.imgMarker}
            style={{ left: "22%", top: "28%", width: "55%", height: "30%" }}
          />
        </div>
        <div className={`${styles.imgTile} ${styles.imgTileWarm}`}>
          <div className={styles.imgPh} />
          <div className={styles.imgCorner}>
            <VerdictPill kind="human" small>
              Human
            </VerdictPill>
          </div>
          <div className={styles.imgLabel}>street_dx.jpg</div>
        </div>
        <div className={`${styles.imgTile} ${styles.imgTileViolet}`}>
          <div className={styles.imgPh} />
          <div className={styles.imgCorner}>
            <VerdictPill kind="mixed" small>
              Mixed
            </VerdictPill>
          </div>
          <div className={styles.imgLabel}>composite_2.webp</div>
        </div>
      </div>
      <ScoreReadout
        value={87}
        top="3 images analyzed · 1 AI-generated, 1 human, 1 mixed"
        bot="Region-level localization on portrait_03.png"
        badge={<VerdictPill kind="ai">1 flagged</VerdictPill>}
      />
    </div>
  );
}

function AudioDemo() {
  // Stable pseudo-waveform: deterministic from index, so it never reflows
  // between renders or hydrations.
  const bars = Array.from({ length: 64 }, (_, i) => {
    const x = i / 64;
    const a = Math.sin(x * 14) * 0.5 + 0.5;
    const b = Math.sin(x * 31 + 1) * 0.3 + 0.5;
    return Math.round((a * 0.6 + b * 0.4) * 92 + 8);
  });
  return (
    <div className={styles.canvas}>
      <div className={styles.audioHeader}>
        <div className={styles.audioFile}>voice_memo_044.wav</div>
        <VerdictPill kind="ai">Synthetic voice detected</VerdictPill>
      </div>
      <div className={styles.wave}>
        {bars.map((h, i) => (
          <div
            key={i}
            className={styles.waveBar}
            style={{
              height: `${h}%`,
              opacity: i > 18 && i < 38 ? 1 : 0.45,
            }}
          />
        ))}
      </div>
      <div className={styles.timeline}>
        <span>00:14</span>
        <div className={styles.track}>
          <div className={styles.trackProgress} />
          <div
            className={styles.trackRegion}
            style={{ left: "28%", width: "30%" }}
          />
        </div>
        <span>00:42</span>
      </div>
      <ScoreReadout
        value={92}
        top="Cloned voice — match against 3 known TTS profiles"
        bot="Region 00:18–00:31 · prosody & spectral flags"
      />
    </div>
  );
}

function VideoDemo() {
  return (
    <div className={styles.canvas}>
      <div className={styles.videoFrame}>
        <div className={styles.cornerBadge}>DEEPFAKE · 0:42</div>
        <div className={styles.playBtn}>
          <Icon name="play" size={22} />
        </div>
      </div>
      <div className={styles.frameStrip}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`${styles.frameMini} ${
              i >= 4 && i <= 8 ? styles.frameMiniFlagged : ""
            }`}
          />
        ))}
      </div>
      <ScoreReadout
        value={78}
        top="Face-swap detected on frames 132–212"
        bot="Trust border draws on the player when AI is detected"
        badge={<VerdictPill kind="ai">Deepfake</VerdictPill>}
      />
    </div>
  );
}

function ExtensionDemo() {
  const stats = [
    { l: "Pages scanned today", v: "182", c: "var(--color-fg)" },
    { l: "AI flagged", v: "47", c: "var(--color-ai-ink)" },
    { l: "Human verified", v: "108", c: "var(--color-human-ink)" },
  ];
  return (
    <div className={styles.canvas}>
      <div className={styles.extCard}>
        <div className={styles.extHead}>
          <span className={styles.extName}>heynotai</span>
          <span className={styles.extVersion}>v0.1 · drawer</span>
          <span style={{ flex: 1 }} />
          <VerdictPill kind="mixed">Watching tab</VerdictPill>
        </div>
        <div className={styles.extStats}>
          {stats.map((s) => (
            <div key={s.l} className={styles.extStat}>
              <div
                className={styles.extStatValue}
                style={{ color: s.c }}
              >
                {s.v}
              </div>
              <div className={styles.extStatLabel}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <ScoreReadout
        top="Live trust borders on YouTube, X, news sites"
        bot="A colored border around the player tells you the verdict before you press play"
      />
    </div>
  );
}

/** 4-point sparkle — the AI Detector brand mark. Filled silhouette so it
    reads cleanly at 11–18px. */
function FourPointSparkle({ size = 11 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C12 8 16 12 22 12C16 12 12 16 12 22C12 16 8 12 2 12C8 12 12 8 12 2Z" />
    </svg>
  );
}
