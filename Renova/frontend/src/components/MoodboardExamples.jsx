"use client";

export default function MoodboardExamples() {
  const noop = (e) => e?.preventDefault?.();

  const boards = [
    { key: "living",  title: "Living room",   img: "/mb-living.jpg" },
    { key: "bath",    title: "Bathroom",      img: "/mb-bathroom.jpg" },
    { key: "kitchen", title: "Kitchen",       img: "/mb-kitchen.jpg" },
    { key: "bed",     title: "Bedroom",       img: "/mb-bedroom.jpg" },
    { key: "child",   title: "Child’s room",  img: "/mb-child.jpg" },
    { key: "studio",  title: "Studio",        img: "/mb-studio.jpg" },
    { key: "study",   title: "Study room",    img: "/mb-study.jpg" },
    { key: "dorm",    title: "Dorm room",     img: "/mb-dorm.jpg" },
    { key: "guest",   title: "Guest room",    img: "/mb-guest.jpg" },
    { key: "master",  title: "Master Bedroom",img: "/mb-master.jpg"},
  ];

  return (
    <section id="examples" className="section examples">
      <div className="container">
        <header className="examples-head">
          <span className="eyebrow">Moodboard presets</span>
          <h2>Explore popular room types</h2>
          <p className="intro">
            Click any preset to start a board with sample items pre-loaded. (Links are placeholders for now.)
          </p>
        </header>

        <div className="examples-grid">
          {boards.map((b) => (
            <a
              key={b.key}
              href="#"
              onClick={noop}
              className="example-card"
              aria-label={`${b.title} moodboard`}
            >
              <img className="example-img" src={b.img} alt={`${b.title} moodboard`} />
              <div className="example-overlay">
                <h3>{b.title}</h3>
              </div>

              <div className="shine" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
