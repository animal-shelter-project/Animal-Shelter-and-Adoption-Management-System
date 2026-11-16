import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth/useAuth.js';
import AnimalCard from '../components/AnimalCard.jsx';
import CountUp from '../components/CountUp.jsx';
import HeroCarousel from '../components/HeroCarousel.jsx';
import Icon from '../components/Icon.jsx';
import { AGE_GROUPS } from '../constants.js';
import { useDocumentTitle, useResource } from '../hooks.js';
import { SHELTER } from '../siteContent.js';

const SLIDES = [
  {
    id: 'meet',
    tone: 'orange',
    eyebrow: 'Adopt a friend',
    title: 'Someone here is waiting for you',
    text: 'Dogs, cats, rabbits and birds are ready for a home today. Read their stories and apply online in about ten minutes.',
    cta: { label: 'Meet the animals', to: '/animals' },
    image: '/images/hero-friends.jpg',
    focus: '60% center',
    pets: [
      { id: 'dog', species: 'Dog', breed: 'Golden Retriever' },
      { id: 'cat', species: 'Cat', breed: 'Domestic Shorthair' },
    ],
  },
  {
    id: 'how',
    tone: 'teal',
    eyebrow: 'Adoption made simple',
    title: 'From hello to home in four steps',
    text: 'Find your match, apply online, hear back from our staff, then take your new friend home with their medical records.',
    cta: { label: 'How adoption works', to: '/adopt/how-it-works' },
    image: '/images/hero-cat.jpg',
    focus: 'center 30%',
    pets: [{ id: 'rabbit', species: 'Rabbit', breed: 'Holland Lop' }],
  },
  {
    id: 'foster',
    tone: 'olive',
    eyebrow: 'Foster',
    title: 'Open your home for a few weeks',
    text: 'Fostering gives an animal a break from the shelter while they wait for a family. We cover food, supplies and vet care.',
    cta: { label: 'Learn about fostering', to: '/foster' },
    image: '/images/hero-foster.jpg',
    focus: '55% center',
    pets: [
      { id: 'beagle', species: 'Dog', breed: 'Beagle' },
      { id: 'siamese', species: 'Cat', breed: 'Siamese' },
    ],
  },
];

const WAYS = [
  {
    icon: 'heart',
    title: 'Adopt',
    text: 'Give a dog, cat or rabbit a forever home. Every adoption includes vaccinations and a health check.',
    to: '/animals',
    link: 'Find your match',
  },
  {
    icon: 'home',
    title: 'Foster',
    text: 'Care for an animal at home for a few weeks while they wait for their family.',
    to: '/foster',
    link: 'About fostering',
  },
  {
    icon: 'hands',
    title: 'Volunteer',
    text: 'Walk dogs, cuddle shy cats and help at adoption events. A few hours a week makes a difference.',
    to: '/volunteer',
    link: 'Volunteer with us',
  },
];

const STEPS = [
  ['Find your match', 'Browse who is available and read their profiles.'],
  ['Apply online', 'Answer a few questions about your home. About ten minutes.'],
  ['Hear from us', 'Our staff review your application and message you here.'],
  ['Go home together', 'Meet your new friend and take them home.'],
];

const TYPES = [
  { species: 'Dog', label: 'Dogs', image: '/images/tile-dogs.jpg' },
  { species: 'Cat', label: 'Cats', image: '/images/tile-cats.jpg' },
  { species: 'Rabbit', label: 'Rabbits', image: '/images/tile-rabbits.jpg' },
  { species: 'Bird', label: 'Birds', image: '/images/tile-birds.jpg' },
];

// "Find your new best friend": type, age and name in one row, then the list.
function QuickFinder() {
  const navigate = useNavigate();
  const [species, setSpecies] = useState('');
  const [age, setAge] = useState('');
  const [name, setName] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (species) q.set('species', species);
    if (age) q.set('age', age);
    if (name.trim()) q.set('name', name.trim());
    const qs = q.toString();
    navigate(qs ? `/animals?${qs}` : '/animals');
  };
  return (
    <form className="finder" onSubmit={submit} aria-labelledby="finder-title">
      <h2 id="finder-title" className="finder-title">
        <Icon name="search" /> Find your new best friend
      </h2>
      <div className="finder-fields">
        <label>
          Type of animal
          <select value={species} onChange={(e) => setSpecies(e.target.value)}>
            <option value="">Any animal</option>
            {TYPES.map((t) => (
              <option key={t.species} value={t.species}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Age
          <select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="">Any age</option>
            {AGE_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name (optional)
          <input type="text" value={name} maxLength={60} placeholder="e.g. Buddy" onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-cta">
          Search
        </button>
      </div>
    </form>
  );
}

// A slow, endless ribbon of the animals' names. Decorative (the names are in
// the cards too), pauses on hover, and stands still for reduced motion.
function NameRibbon({ names }) {
  if (!names?.length) return null;
  const items = [...names, ...names];
  return (
    <div className="ribbon" aria-hidden="true">
      <div className="ribbon-track">
        {[0, 1].map((copy) => (
          <span className="ribbon-group" key={copy}>
            {items.map((n, i) => (
              <span className="ribbon-item" key={`${copy}-${i}`}>
                <Icon name="paw" className="ribbon-paw" />
                {n}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

// Curved edge between two coloured sections.
function Wave({ flip = false, className = '' }) {
  return (
    <svg
      className={`wave${flip ? ' wave-flip' : ''} ${className}`.trim()}
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 40c160 30 320 40 480 25S800 5 960 10s320 40 480 40v30H0z" />
    </svg>
  );
}

const byLongestWait = (a, b) => Number(a.id) - Number(b.id);

export default function Home() {
  useDocumentTitle('');
  const { isLoggedIn } = useAuth();
  const { hash } = useLocation();
  const animals = useResource('home:waiting', (signal) => api.listAnimals({ status: 'Available' }, { signal }));
  const stats = useResource('home:stats', (signal) => api.stats({ signal, auth: false }));
  const waiting = animals.data ? [...animals.data].sort(byLongestWait).slice(0, 4) : null;
  const counts = animals.data
    ? Object.fromEntries(TYPES.map((t) => [t.species, animals.data.filter((a) => a.species === t.species).length]))
    : null;

  // "Our numbers" in the menu links to /#our-numbers.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, stats.data]);

  const names = animals.data ? [...animals.data].sort(byLongestWait).map((a) => a.name) : null;

  return (
    <div className="home">
      <h1 className="visually-hidden">{SHELTER.name}: adopt a dog, cat or rabbit</h1>
      <HeroCarousel
        slides={SLIDES}
        badge={stats.data ? { number: stats.data.available, text: 'animals ready today' } : null}
      />

      <div className="wrap finder-wrap" data-reveal="up">
        <QuickFinder />
      </div>

      <section className="section browse" aria-labelledby="browse-title">
        <div className="wrap">
          <div className="section-head" data-reveal="up">
            <div>
              <p className="section-eyebrow">Adopt</p>
              <h2 id="browse-title" className="section-title">
                Who are you looking for?
              </h2>
            </div>
            <Link to="/animals" className="text-link">
              See every animal
              <Icon name="arrowRight" />
            </Link>
          </div>
          <ul className="browse-grid">
            {TYPES.map((t, i) => {
              const n = counts?.[t.species];
              return (
                <li key={t.species} data-reveal="pop" data-reveal-delay={i * 90}>
                  <Link to={`/animals?species=${t.species}`} className="type-tile">
                    <img src={t.image} alt="" />
                    <span className="type-label">
                      <span className="type-name">{t.label}</span>
                      {n != null && <span className="type-count">{n === 0 ? 'None right now' : `${n} available`}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <NameRibbon names={names} />

      <section className="section waiting paw-pattern" aria-labelledby="waiting-title">
        <div className="wrap">
          <div className="section-head" data-reveal="up">
            <div>
              <p className="section-eyebrow">Featured animals</p>
              <h2 id="waiting-title" className="section-title">
                Waiting the longest
              </h2>
              <p className="section-sub">These friends have waited the longest for a family. Could it be you?</p>
            </div>
            <Link to="/animals" className="btn btn-outline">
              See all animals
            </Link>
          </div>
          {animals.error && !waiting && (
            <p className="notice error" role="alert">
              We couldn't load the animals just now. <Link to="/animals">Try the full list</Link>.
            </p>
          )}
          {!waiting && !animals.error && <p className="muted">Loading animals…</p>}
          {waiting?.length === 0 && <p className="muted">Every animal has found a home. Please check back soon!</p>}
          {waiting?.length > 0 && (
            <div className="grid">
              {waiting.map((a) => (
                <AnimalCard key={a.id} animal={a} />
              ))}
            </div>
          )}
        </div>
      </section>

      {stats.data && (
        <section className="stats-band" id="our-numbers" aria-labelledby="numbers-title">
          <Wave className="wave-top" />
          <div className="wrap">
            <h2 id="numbers-title" className="section-title" data-reveal="up">
              Our numbers today
            </h2>
            <p className="stats-lede" data-reveal="up">
              Updated live from our shelter records.
            </p>
            <dl className="stats-grid">
              {[
                ['Animals ready for a home', stats.data.available, 'heart'],
                ['Adoptions this year', stats.data.adoptionsThisYear, 'home'],
                ['In foster homes now', stats.data.inFoster, 'paw'],
              ].map(([label, value, icon], i) => (
                <div key={label} data-reveal="pop" data-reveal-delay={i * 120}>
                  <dt>
                    <Icon name={icon} className="stat-icon" /> {label}
                  </dt>
                  <dd>
                    <CountUp value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <Wave flip className="wave-bottom" />
        </section>
      )}

      <div className="announce" data-reveal="up">
        <p className="wrap">
          {isLoggedIn ? (
            <>
              Follow your applications any time on <Link to="/my-applications">My applications</Link>.
            </>
          ) : (
            <>
              New here? <Link to="/register">Create a free account</Link> to apply and follow your application online.
            </>
          )}
        </p>
      </div>

      <section className="section ways" aria-labelledby="ways-title">
        <div className="wrap">
          <div className="section-head" data-reveal="up">
            <div>
              <p className="section-eyebrow">Our mission: every animal deserves a home</p>
              <h2 id="ways-title" className="section-title">
                Ways to help
              </h2>
            </div>
          </div>
          <ul className="ways-grid">
            {WAYS.map((w, i) => (
              <li key={w.title} className="way" data-reveal="up" data-reveal-delay={i * 120}>
                <span className="way-icon">
                  <Icon name={w.icon} />
                </span>
                <h3>{w.title}</h3>
                <p>{w.text}</p>
                <Link to={w.to} className="text-link">
                  {w.link}
                  <Icon name="arrowRight" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section steps" aria-labelledby="steps-title">
        <div className="wrap">
          <div data-reveal="up">
            <p className="section-eyebrow">Adoption made simple</p>
            <h2 id="steps-title" className="section-title">
              How adoption works
            </h2>
          </div>
          <ol className="steps-list steps-path">
            {STEPS.map(([title, text], i) => (
              <li key={title} data-reveal="left" data-reveal-delay={i * 150}>
                <span className="step-number" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
          <Link to="/adopt/how-it-works" className="text-link">
            Read the full guide
            <Icon name="arrowRight" />
          </Link>
        </div>
      </section>
    </div>
  );
}
