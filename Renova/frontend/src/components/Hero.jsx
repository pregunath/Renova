"use client";

import Hero3D from "@/components/Hero3D";

export default function Hero() {
  const noop = (e) => e?.preventDefault?.(); // placeholder links

  return (
    <section
      className="hero hero-room"
      role="region"
      aria-labelledby="hero-heading"
    >
      <div className="container hero-grid">
        {/* Left */}
        <div className="hero-copy">
          <span className="eyebrow">Create. Arrange. Preview.</span>

          <h1 id="hero-heading">Design your dream room with Renova.</h1>

          <p className="subtitle">
            Try us out and see how your room could look! Upload your space,
            arrange inspirations on a moodboard, and preview AI-powered
            renovations. NO design skills required!!
          </p>

          <div className="cta-row" style={{ display: "flex", gap: "0.75rem" }}>
            <a href="#" onClick={noop} className="btn gradient hero-cta">
              Start a New Board
            </a>
            <a href="#" onClick={noop} className="btn outline hero-cta">
              See Examples
            </a>
          </div>

          <div className="hero-badges">
            <span className="badge">Get 3 trial renders when you sign up</span>
          </div>
        </div>

        {/* Right 3D */}
        <Hero3D />
      </div>
    </section>
  );
}
