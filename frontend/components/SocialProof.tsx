import { Icon } from "./Icon";

type Tweet = {
  name: string;
  handle: string;
  time: string;
  body: React.ReactNode;
  likes: number;
  replies: number;
  image?: "watchon" | null;
};

const TWEETS: Tweet[] = [
  {
    name: "someone",
    handle: "bit lately",
    time: "",
    body: (
      <>
        meeting notes
        <br />
        so far. Not
      </>
    ),
    likes: 0,
    replies: 0,
  },
  {
    name: "Guillermo Rauch",
    handle: "@rauchg",
    time: "7:42 PM · May 22, 2024",
    body: (
      <>
        Write home notes → ai enhances them
        <br />
        Very clever ai-native ux: heynotai
      </>
    ),
    likes: 297,
    replies: 12,
    image: "watchon",
  },
  {
    name: "Dan Shipper",
    handle: "@danshipper",
    time: "9:03 PM · Jun 3, 2024",
    body: (
      <>
        If you aren&apos;t using heynotai for your meetings you are seriously
        missing out.
        <br />
        <br />
        Incredible product.
      </>
    ),
    likes: 31,
    replies: 4,
  },
  {
    name: "MDS",
    handle: "@mds",
    time: "5:34 PM · Sep 19, 2024",
    body: (
      <>
        I love heynotai (the AI genius web app)
      </>
    ),
    likes: 21,
    replies: 7,
  },
  {
    name: "Stevens",
    handle: "@slevenson",
    time: "4:55 AM · Sep 1",
    body: (
      <>
        Replying to @heynotai
        <br />
        Bullish on heynotai — no more &ldquo;AI or not&rdquo; debates in PRs.
      </>
    ),
    likes: 9,
    replies: 1,
  },
];

export function SocialProof() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 text-center">
      <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Trusted by academics, tutors and professionals worldwide.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm text-[var(--color-fg-mid)]">
        heynotai&apos;s AI content originality tool serves several purposes, and
        you can use it for various reasons. Here are just three things our
        AI tool analysis can do.
      </p>

      <div className="mt-12 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
        <div className="flex gap-4 pb-2">
          {TWEETS.map((t, i) => (
            <TweetCard key={i} tweet={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TweetCard({ tweet }: { tweet: Tweet }) {
  return (
    <article className="tweet text-left">
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 flex-shrink-0 rounded-full bg-[var(--color-card)]" />
          <div className="leading-tight">
            <div className="flex items-center gap-1 text-xs font-semibold">
              {tweet.name}
              <Icon name="check" size={10} />
            </div>
            <div className="text-[11px] text-[var(--color-fg-dim)]">
              {tweet.handle} · Follow
            </div>
          </div>
        </div>
        <button aria-label="Dismiss" className="text-[var(--color-fg-dim)]">
          <Icon name="plus" size={14} className="rotate-45" />
        </button>
      </header>

      <div className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed">
        {tweet.body}
      </div>

      {tweet.image === "watchon" && (
        <div className="mt-3 flex h-20 items-center justify-center rounded-md bg-[var(--color-surface-sunken)] text-xs text-[var(--color-fg-mid)]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-soft)]">
              <Icon name="play" size={12} />
            </div>
            Watch on
          </div>
        </div>
      )}

      <div className="mt-3 text-[10px] text-[var(--color-fg-dim)]">{tweet.time}</div>

      <footer className="mt-3 flex items-center gap-3 border-t border-[var(--color-line)] pt-2 text-[11px] text-[var(--color-fg-mid)]">
        <span className="inline-flex items-center gap-1">
          <Icon name="heart" size={12} /> {tweet.likes}
        </span>
        <span>Reply</span>
        <span className="inline-flex items-center gap-1">
          <Icon name="link" size={12} /> Copy link
        </span>
      </footer>
      {tweet.replies > 0 && (
        <div className="mt-2 text-[11px] text-[var(--color-accent-ink)]">
          Read {tweet.replies} replies
        </div>
      )}
    </article>
  );
}
