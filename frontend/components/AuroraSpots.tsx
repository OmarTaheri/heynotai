import type { CSSProperties } from "react";

type Spot = {
  size: string;
  x: string;
  y: string;
  opacity: string;
  tilt: string;
};

/* Hand-tuned scatter across the page. Each spot gets its own rotation
   (`tilt`) so the three internal lobes start in a different orientation
   per spot — at any moment the lobes inside spot A are arranged
   completely differently from spot B, and the resulting silhouettes
   have nothing in common. */
const SPOTS: Spot[] = [
  { size: "640px", x: "12%", y: "6%",  opacity: "0.55", tilt: "0deg"   },
  { size: "560px", x: "82%", y: "16%", opacity: "0.5",  tilt: "120deg" },
  { size: "720px", x: "8%",  y: "32%", opacity: "0.45", tilt: "55deg"  },
  { size: "580px", x: "70%", y: "44%", opacity: "0.5",  tilt: "200deg" },
  { size: "680px", x: "20%", y: "60%", opacity: "0.45", tilt: "30deg"  },
  { size: "520px", x: "85%", y: "72%", opacity: "0.5",  tilt: "150deg" },
  { size: "620px", x: "30%", y: "86%", opacity: "0.45", tilt: "85deg"  },
];

export function AuroraSpots() {
  return (
    <div className="aurora-field" aria-hidden>
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className="aurora-spot"
          style={
            {
              "--spot-size": s.size,
              "--spot-x": s.x,
              "--spot-y": s.y,
              "--spot-opacity": s.opacity,
              "--spot-tilt": s.tilt,
            } as CSSProperties
          }
        >
          <span className="lobe lobe-a" />
          <span className="lobe lobe-b" />
          <span className="lobe lobe-c" />
        </span>
      ))}
    </div>
  );
}
