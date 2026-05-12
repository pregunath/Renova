"use client";

export default function Features() {
  // placeholder links for now
  const noop = (e) => e?.preventDefault?.();

  const items = [
    {
      key: "photo",
      eyebrow: "Feature 01",
      title: "Take a photo",
      body:
        "Snap or upload your room. We’ll auto-fit the canvas, detect perspective, and prep it for instant styling.",
      bullets: [
        "Supports phone photos",
        "Auto depth & mask prep (coming soon)",
        "Privacy-friendly: guest mode keeps it local",
      ],
      img: "/feat-photo.jpg",
      alt: "Upload room photo — placeholder",
      cta: { label: "Try with a sample", href: "#" },
    },
    {
      key: "room",
      eyebrow: "Feature 02",
      title: "Mood-Boards",
      body:
        "Drag furniture, resize, rotate, and layer items to build a moodboard. Save boards when you sign up.",
      bullets: [
        "Drag & drop moodboard",
        "Undo/redo & snapping (planned)",
        "Export preview to PNG/JPG",
      ],
      img: "/feat-room.jpg",
      alt: "Create a room board — placeholder",
      cta: { label: "Start a new board", href: "#" },
      flip: true, // flips layout
    },
    {
      key: "sketch",
      eyebrow: "Feature 03",
      title: "Sketches → photos",
      body:
        "Rough sketch an idea and let Renova generate a realistic preview in your actual space.",
      bullets: [
        "Sketch in browser (soon)",
        "AI upscaling for crisp results",
        "Keep originals & variants",
      ],
      img: "/feat-sketch.jpg",
      alt: "Sketch to photo — placeholder",
      cta: { label: "See examples", href: "#" },
    },
    {
      key: "ai",
      eyebrow: "Feature 04",
      title: "AI Generations",
      body:
        "Turn your moodboard into photoreal concepts with 1-click themes. Control strength to keep layout, colors, and style consistent.",
      bullets: [
        "Photoreal variants in seconds",
        "Theme presets & style controls",
        "Keep room layout/perspective",
        "3 trial renders on signup",
      ],
      img: "/feat-AI.jpg", 
      alt: "AI generations preview — placeholder",
      cta: { label: "Generate a look", href: "#" },
      flip: true, 
    },
  ];

  return (
    <section id="features" className="section features">
      <div className="container">
        <header className="features-head">
          <span className="eyebrow">What you can do</span>
          <h2>Powerful tools, simple flow</h2>
          <p className="intro">
            Start with a photo, arrange your ideas, then preview with AI. No
            design experience required.
          </p>
        </header>

        <div className="features-stack">
          {items.map((f) => (
            <article
              key={f.key}
              className={`feature-row ${f.flip ? "flip" : ""}`}
            >
              <div className="feature-copy">
                <span className="eyebrow">{f.eyebrow}</span>
                <h3>{f.title}</h3>
                <p className="body">{f.body}</p>

                <ul className="bullet-list">
                  {f.bullets.map((b, idx) => (
                    <li key={idx}>
                      <span className="check" aria-hidden="true">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="cta-row">
                  <a href={f.cta.href} onClick={noop} className="btn primary">
                    {f.cta.label}
                  </a>
                </div>
              </div>
              <div className="feature-media">
                <figure className="feature-card">
                  <img src={f.img} alt={f.alt} />
                  <figcaption>{f.title}</figcaption>
                </figure>
                <div className="blob blob-a" aria-hidden="true" />
                <div className="blob blob-b" aria-hidden="true" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
