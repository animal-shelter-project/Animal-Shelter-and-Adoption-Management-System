import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import PetArt from './PetArt.jsx';

// Home page banner that moves to the next slide every 8 seconds.
// Accessible by design:
//  - a Pause button (moving content must be stoppable), and it doesn't move
//    at all for people who ask for reduced motion
//  - it also stops while the mouse or keyboard focus is inside it
//  - Previous / Next and "go to slide" buttons, all keyboard reachable
//  - screen readers hear "slide 2 of 3", and the change is announced only
//    when the user moves it themselves
const INTERVAL_MS = 8000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export default function HeroCarousel({ slides, badge }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [held, setHeld] = useState(false); // mouse over / focus inside
  const [userMoved, setUserMoved] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (!playing || held || count < 2) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearTimeout(t);
  }, [playing, held, index, count]);

  const go = (i) => {
    setUserMoved(true);
    setIndex((i + count) % count);
  };
  const slide = slides[index];

  return (
    <section
      className="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Highlights"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHeld(false);
      }}
    >
      <div
        className={`hero-slide hero-slide-${slide.tone}`}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${count}`}
        aria-live={userMoved ? 'polite' : 'off'}
        key={slide.id}
      >
        <div className="hero-copy">
          <p className="hero-eyebrow">{slide.eyebrow}</p>
          <h2 className="hero-heading">{slide.title}</h2>
          <p className="hero-text">{slide.text}</p>
          <Link to={slide.cta.to} className="btn btn-cta btn-large">
            {slide.cta.label}
            <Icon name="arrowRight" />
          </Link>
        </div>
        {slide.image ? (
          <div className="hero-art hero-art-photo">
            {/* Decorative: the heading and text already say what the slide is about. */}
            <img src={slide.image} alt="" style={{ objectPosition: slide.focus || 'center' }} />
            {badge && (
              <span className="hero-badge">
                <strong>{badge.number}</strong>
                {badge.text}
              </span>
            )}
          </div>
        ) : (
          <div className="hero-art" aria-hidden="true">
            {slide.pets.map((pet) => (
              <PetArt key={pet.id} animal={pet} className={`hero-art-pet hero-art-${pet.id}`} />
            ))}
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="hero-controls">
          <button type="button" className="hero-control" onClick={() => go(index - 1)}>
            <Icon name="chevronLeft" label="Previous slide" />
          </button>
          <ul className="hero-dots">
            {slides.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`hero-dot${i === index ? ' is-current' : ''}`}
                  aria-label={`Go to slide ${i + 1}: ${s.title}`}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => go(i)}
                />
              </li>
            ))}
          </ul>
          <button type="button" className="hero-control" onClick={() => go(index + 1)}>
            <Icon name="chevronRight" label="Next slide" />
          </button>
          <button type="button" className="hero-control hero-pause" onClick={() => setPlaying((p) => !p)}>
            <Icon name={playing ? 'pause' : 'play'} />
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
        </div>
      )}
    </section>
  );
}
