// The heynotai logo mark — stylized eye aperture.
export function Mark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2 12 C 7 3, 17 3, 22 12 C 17 21, 7 21, 2 12 Z" stroke="currentColor" strokeWidth={1.8} fill="none" />
      <path d="M8 12 C 10 8, 14 8, 16 12 C 14 16, 10 16, 8 12 Z" fill="currentColor" />
      <circle cx={12} cy={12} r={1.6} fill="#fff" style={{ mixBlendMode: 'difference' }} />
    </svg>
  );
}
