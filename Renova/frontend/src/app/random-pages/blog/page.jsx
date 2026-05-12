"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import s from "../../../styles/random-pages/randomPages.module.css";

const POSTS = [
  {
    slug: "planning-with-confidence",
    category: "Product",
    title: "Planning with confidence before you spend",
    excerpt:
      "Renova helps users move from scattered inspiration to a more organized renovation plan with fewer expensive mistakes.",
    date: "March 2026",
    readTime: "4 min read",
    tags: ["Planning", "Renovation", "Product"],
  },
  {
    slug: "inside-the-moodboard-workflow",
    category: "Product",
    title: "Inside the moodboard workflow",
    excerpt:
      "A closer look at how moodboards support visual exploration, organization, and faster iteration during early design planning.",
    date: "March 2026",
    readTime: "5 min read",
    tags: ["Moodboards", "UX", "Workflow"],
  },
  {
    slug: "building-renova-with-nextjs",
    category: "Engineering",
    title: "Building Renova with Next.js and modern UI patterns",
    excerpt:
      "Why the team chose a modern React stack to support dashboard flows, account pages, and a polished front-end experience.",
    date: "March 2026",
    readTime: "6 min read",
    tags: ["Next.js", "React", "Frontend"],
  },
  {
    slug: "why-visualization-matters",
    category: "Design",
    title: "Why visualization matters in renovation planning",
    excerpt:
      "Seeing ideas before committing helps users compare options, reduce uncertainty, and make more informed design choices.",
    date: "March 2026",
    readTime: "4 min read",
    tags: ["Design", "Visualization", "Planning"],
  },
  {
    slug: "ai-previews-and-user-trust",
    category: "Research",
    title: "AI previews and user trust",
    excerpt:
      "AI-assisted previews are only useful when they help people evaluate ideas clearly instead of adding more confusion.",
    date: "March 2026",
    readTime: "5 min read",
    tags: ["AI", "Research", "Trust"],
  },
  {
    slug: "team-updates-and-roadmap",
    category: "Updates",
    title: "Team updates and where Renova is headed",
    excerpt:
      "A look at recent product progress, upcoming improvements, and how the project is evolving over time.",
    date: "March 2026",
    readTime: "3 min read",
    tags: ["Updates", "Roadmap", "Team"],
  },
  {
    slug: "designing-for-real-users",
    category: "Design",
    title: "Designing for real users, not perfect scenarios",
    excerpt:
      "Good product decisions come from making tools easier to understand, easier to trust, and easier to return to later.",
    date: "February 2026",
    readTime: "4 min read",
    tags: ["Design", "Users", "Product"],
  },
  {
    slug: "account-billing-lessons",
    category: "Engineering",
    title: "Lessons from account and billing flows",
    excerpt:
      "Building account and billing logic requires careful attention to user expectations, limits, and secure enforcement.",
    date: "February 2026",
    readTime: "5 min read",
    tags: ["Billing", "Accounts", "Backend"],
  },
  {
    slug: "future-of-collaborative-design",
    category: "Research",
    title: "The future of collaborative design planning",
    excerpt:
      "Renova is exploring ways teams and users can work together more smoothly when shaping renovation ideas.",
    date: "February 2026",
    readTime: "4 min read",
    tags: ["Collaboration", "Research", "Future"],
  },
];

const ITEMS_PER_PAGE = 6;

function BlogPageContent() {
  const searchParams = useSearchParams();
  const isLight = searchParams.get("theme") === "light";
  const themedHref = (href) =>
    isLight
      ? href.includes("?")
        ? `${href}&theme=light`
        : `${href}?theme=light`
      : href;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [selectedSlug, setSelectedSlug] = useState(POSTS[0].slug);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const categories = useMemo(() => {
    return ["All", ...new Set(POSTS.map((post) => post.category))];
  }, []);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return POSTS.filter((post) => {
      const matchesCategory = category === "All" || post.category === category;
      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.tags.some((tag) => tag.toLowerCase().includes(q));

      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  useEffect(() => {
    setPage(1);
  }, [query, category]);

  useEffect(() => {
    if (!filteredPosts.length) return;
    const selectedStillVisible = filteredPosts.some(
      (post) => post.slug === selectedSlug
    );
    if (!selectedStillVisible) {
      setSelectedSlug(filteredPosts[0].slug);
    }
  }, [filteredPosts, selectedSlug]);

  const featuredPost =
    filteredPosts.find((post) => post.slug === selectedSlug) ||
    filteredPosts[0] ||
    null;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPosts.length / ITEMS_PER_PAGE)
  );
  const currentPage = Math.min(page, totalPages);

  const pagedPosts = filteredPosts
    .filter((post) => post.slug !== featuredPost?.slug)
    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  function handleSubscribe(e) {
    e.preventDefault();

    const subject = "Renova Blog Subscription";
    const body = `Please add this email to future Renova blog updates:\n\n${subscribeEmail}`;
    window.location.href = `mailto:sdmay26-16@iastate.edu?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    setSubscribed(true);
  }

  return (
    <div className={`${s.blogPage} ${isLight ? s.blogPageLight : ""}`}>
      <div className={s.blogBg} aria-hidden="true" />

      <main className={s.blogWrap}>
        <section className={s.blogHero}>
          <div className={s.blogHeroCard}>
            <div className={s.blogBadge}>Renova Blog</div>

            <h1 className={s.blogH1}>
              Ideas, updates, and product thinking from Renova.
            </h1>

            <p className={s.blogSub}>
              Explore project updates, design insights, technical lessons, and
              the thinking behind how Renova supports renovation planning.
            </p>

            <div className={s.blogControls}>
              <div className={s.blogSearchWrap}>
                <input
                  className={s.blogSearch}
                  type="text"
                  placeholder="Search posts, topics, or tags..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className={s.blogSearchHint}>
                  Search by title, summary, or tag.
                </div>
              </div>

              <div className={s.blogPills}>
                {categories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`${s.blogPill} ${
                      category === item ? s.blogPillActive : ""
                    }`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {featuredPost ? (
            <article className={s.blogFeatured}>
              <div className={s.blogFeaturedTop}>
                <div className={s.blogFeaturedBadge}>Featured</div>

                <div className={s.blogFeaturedMeta}>
                  <span className={s.blogMetaChip}>{featuredPost.category}</span>
                  <span className={s.blogDot} aria-hidden="true">
                    •
                  </span>
                  <span>{featuredPost.date}</span>
                  <span className={s.blogDot} aria-hidden="true">
                    •
                  </span>
                  <span>{featuredPost.readTime}</span>
                </div>
              </div>

              <h2 className={s.blogFeaturedTitle}>{featuredPost.title}</h2>

              <p className={s.blogFeaturedExcerpt}>{featuredPost.excerpt}</p>

              <div className={s.blogTagRow}>
                {featuredPost.tags.map((tag) => (
                  <span key={tag} className={s.blogTag}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className={s.blogFeaturedActions}>
                <Link className={s.blogBtnPrimary} href="/dashboard/moodboards">
                  Explore Renova
                </Link>
                <Link
                  className={s.blogBtnGhost}
                  href={themedHref("/random-pages/contact")}
                >
                  Contact the team
                </Link>
              </div>
            </article>
          ) : (
            <div className={s.blogFeatured}>
              <div className={s.blogEmptyTitle}>No featured article</div>
              <div className={s.blogEmptySub}>
                Try changing the search term or selecting a different category.
              </div>
            </div>
          )}
        </section>

        <section className={s.blogSection}>
          <div className={s.blogSectionHead}>
            <div>
              <h2 className={s.blogH2}>Latest posts</h2>
              <p className={s.blogP}>
                Browse updates, product notes, and design thinking from the
                Renova team.
              </p>
            </div>
          </div>

          {pagedPosts.length > 0 ? (
            <>
              <div className={s.blogGrid}>
                {pagedPosts.map((post) => (
                  <article key={post.slug} className={s.blogCard}>
                    <div className={s.blogCardTop}>
                      <span className={s.blogMetaChip}>{post.category}</span>
                      <span className={s.blogCardMeta}>
                        {post.date} · {post.readTime}
                      </span>
                    </div>

                    <h3 className={s.blogCardTitle}>{post.title}</h3>

                    <p className={s.blogCardExcerpt}>{post.excerpt}</p>

                    <div className={s.blogCardActions}>
                      <button
                        type="button"
                        className={s.blogBtnPrimarySmall}
                        onClick={() => setSelectedSlug(post.slug)}
                      >
                        Feature post
                      </button>

                      <Link
                        className={s.blogLinkMuted}
                        href={themedHref("/random-pages/contact")}
                      >
                        Ask about it →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className={s.blogPager}>
                <button
                  type="button"
                  className={s.blogPageBtn}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                >
                  ←
                </button>

                <div className={s.blogPageCount}>
                  Page {currentPage} of {totalPages}
                </div>

                <button
                  type="button"
                  className={s.blogPageBtn}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  →
                </button>
              </div>
            </>
          ) : (
            <div className={s.blogEmpty}>
              <div className={s.blogEmptyTitle}>No posts found</div>
              <div className={s.blogEmptySub}>
                Try a broader search or switch back to a different category.
              </div>
              <button
                type="button"
                className={s.blogBtn}
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>

        <section className={s.blogCta}>
          <div className={s.blogCtaCard}>
            <div>
              <h2 className={s.blogH2}>Stay in the loop</h2>
              <p className={s.blogP}>
                Want updates about Renova progress, design ideas, and future
                features?
              </p>
            </div>

            <form className={s.blogSubscribe} onSubmit={handleSubscribe}>
              <input
                className={s.blogSubscribeInput}
                type="email"
                placeholder="Email address"
                value={subscribeEmail}
                onChange={(e) => setSubscribeEmail(e.target.value)}
                required
              />
              <button className={s.blogBtnPrimary} type="submit">
                Subscribe
              </button>
            </form>
          </div>

          {subscribed ? (
            <div className={s.blogNotice}>
              Your email app should open with a prefilled subscription request.
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function BlogPageFallback() {
  return (
    <div className={s.blogPage}>
      <div className={s.blogBg} aria-hidden="true" />
      <main className={s.blogWrap}>
        <section className={s.blogHero}>
          <div className={s.blogHeroCard}>
            <div className={s.blogBadge}>Renova Blog</div>
            <h1 className={s.blogH1}>
              Ideas, updates, and product thinking from Renova.
            </h1>
            <p className={s.blogSub}>Loading blog…</p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function BlogPage() {
  return (
    <Suspense fallback={<BlogPageFallback />}>
      <BlogPageContent />
    </Suspense>
  );
}