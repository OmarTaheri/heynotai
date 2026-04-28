/**
 * Hero-style greeting at the top of the home page.
 *
 * Borrowed from the marketing hero's "Hey. That's not human." pattern:
 * the surrounding phrase renders dimmed, the addressee renders at full
 * opacity so it pops as the line's anchor. Inter only — weight + size
 * + letter-spacing carry the editorial feel.
 */
export function Greeting({
  greeting,
  accentName,
  subtitle,
}: {
  greeting: string;
  accentName: string;
  subtitle: string;
}) {
  return (
    <header className="home-greet">
      <div>
        <h1 className="home-greet-h1">
          {greeting}, <em>{accentName}</em>
        </h1>
        <p className="home-greet-sub">{subtitle}</p>
      </div>
    </header>
  );
}
