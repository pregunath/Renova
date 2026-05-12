// components/auth/AuthInfo.jsx

import Link from "next/link";

export default function AuthInfo() {
  return (
    <div className="auth-info">
      <Link href="/" className="auth-brand" aria-label="Go to Renova home">
        <span className="logo-badge" aria-hidden="true">R</span>
        <h1>Renova</h1>
      </Link>
      <p className="auth-tagline">
        Design your dream room with AI-powered tools. Create moodboards, preview renovations, and bring your vision to life.
      </p>
      <div className="auth-features">
        <div className="feature-item">
          <span className="feature-icon">🎨</span>
          <span>Drag & drop moodboard</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">🤖</span>
          <span>AI-powered previews</span>
        </div>
        <div className="feature-item">
          <span className="feature-icon">⚡</span>
          <span>3 trial renders on signup</span>
        </div>
      </div>
    </div>
  );
}