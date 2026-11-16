import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { openStatus } from '../hours.js';
import { useResource } from '../hooks.js';
import { TEAM, TIMELINE } from '../siteContent.js';
import AnimalCard from './AnimalCard.jsx';
import CountUp from './CountUp.jsx';
import Icon from './Icon.jsx';

// Pieces for the About, Contact and Foster pages.

// "How we got here": a timeline whose steps slide in as you scroll.
export function StoryTimeline() {
  return (
    <ol className="timeline-story">
      {TIMELINE.map((t, i) => (
        <li key={t.year} data-reveal={i % 2 ? 'right' : 'left'}>
          <span className="timeline-year">{t.year}</span>
          <div className="timeline-card">
            <h3>{t.title}</h3>
            <p>{t.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Team() {
  return (
    <ul className="team-grid">
      {TEAM.map((m, i) => (
        <li key={m.name} className="team-card" data-reveal="pop" data-reveal-delay={i * 120}>
          <span className="team-avatar" aria-hidden="true">
            {m.initials}
          </span>
          <h3>{m.name}</h3>
          <p>{m.role}</p>
        </li>
      ))}
    </ul>
  );
}

// Live numbers from GET /api/stats.
export function Impact() {
  const stats = useResource('home:stats', (signal) => api.stats({ signal, auth: false }));
  if (!stats.data) return null;
  const items = [
    ['heart', stats.data.available, 'animals ready for a home', '/animals'],
    ['home', stats.data.adoptionsThisYear, 'adoptions this year', '/adopt/how-it-works'],
    ['paw', stats.data.inFoster, 'animals in foster homes', '/foster'],
    ['check', stats.data.adopted, 'animals adopted and settled', '/animals?status=all'],
  ];
  return (
    <ul className="impact-grid">
      {items.map(([icon, value, label, to], i) => (
        <li key={label} data-reveal="pop" data-reveal-delay={i * 100}>
          <Link to={to} className="impact-card">
            <Icon name={icon} className="impact-icon" />
            <span className="impact-number">
              <CountUp value={value} />
            </span>
            <span className="impact-label">{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// "Open now · closes at 7 pm", updated every minute.
export function OpenNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const status = openStatus(now);
  return (
    <p className={`open-now ${status.open ? 'is-open' : 'is-closed'}`} data-testid="open-now">
      <span className="open-dot" aria-hidden="true" />
      <Icon name="clock" />
      {status.text}
    </p>
  );
}

// Animals currently in foster homes (live from the catalog).
export function FosteredNow() {
  const list = useResource('foster:now', (signal) => api.listAnimals({ status: 'Fostered' }, { signal }));
  if (!list.data) return <p className="muted">Loading…</p>;
  if (list.data.length === 0) {
    return <p className="muted">No animals are in foster homes right now. Yours could be the first!</p>;
  }
  return (
    <div className="grid">
      {list.data.map((a) => (
        <AnimalCard key={a.id} animal={a} />
      ))}
    </div>
  );
}
