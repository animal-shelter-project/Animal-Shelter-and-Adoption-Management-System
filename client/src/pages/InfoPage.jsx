import { Link, useLocation } from 'react-router-dom';
import { FosteredNow, Impact, OpenNow, StoryTimeline, Team } from '../components/AboutWidgets.jsx';
import Icon from '../components/Icon.jsx';
import { ContactForm, FosterForm, VolunteerForm } from '../components/SignupForms.jsx';
import { WishList, WishPreview } from '../components/WishList.jsx';
import { useDocumentTitle } from '../hooks.js';
import { INFO_PAGES, MAIN_MENU, SHELTER } from '../siteContent.js';
import NotFound from './NotFound.jsx';

// One template for every information page (How adoption works, FAQs,
// Foster, Volunteer, Donate, About, Contact). The words live in
// siteContent.js.
function ContactDetails() {
  return (
    <div className="contact-grid">
      <div className="contact-card">
        <h3>
          <Icon name="pin" /> Address
        </h3>
        <address>
          {SHELTER.name}
          <br />
          {SHELTER.street}
          <br />
          {SHELTER.city}
        </address>
      </div>
      <div className="contact-card">
        <h3>
          <Icon name="phone" /> Phone and email
        </h3>
        <p>
          <a href={SHELTER.phoneHref}>{SHELTER.phone}</a>
        </p>
        <p>
          <a href={`mailto:${SHELTER.email}`}>{SHELTER.email}</a>
        </p>
      </div>
      <div className="contact-card">
        <h3>
          <Icon name="clock" /> Opening hours
        </h3>
        <dl className="hours">
          {SHELTER.hours.map(([days, time]) => (
            <div key={days}>
              <dt>{days}</dt>
              <dd>{time}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// Interactive pieces a section can include (see `widget` in siteContent.js).
function widget(name) {
  switch (name) {
    case 'fosterForm':
      return <FosterForm />;
    case 'volunteerForm':
      return <VolunteerForm />;
    case 'contactForm':
      return <ContactForm />;
    case 'wishList':
      return <WishList />;
    case 'wishPreview':
      return <WishPreview />;
    case 'timeline':
      return <StoryTimeline />;
    case 'team':
      return <Team />;
    case 'impact':
      return <Impact />;
    case 'openNow':
      return <OpenNow />;
    case 'fostered':
      return <FosteredNow />;
    default:
      return null;
  }
}

function Section({ section }) {
  return (
    <section className="info-section" data-reveal="up">
      <h2>{section.heading}</h2>
      {section.text?.map((t) => (
        <p key={t}>{t}</p>
      ))}
      {section.list && (
        <ul className="check-list">
          {section.list.map((item) => (
            <li key={item}>
              <Icon name="check" />
              {item}
            </li>
          ))}
        </ul>
      )}
      {section.steps && (
        <ol className="steps-list steps-list-wide">
          {section.steps.map((s, i) => (
            <li key={s.title}>
              <span className="step-number" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      )}
      {section.faqs && (
        <div className="faqs">
          {section.faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      )}
      {section.contact && <ContactDetails />}
      {section.widget && widget(section.widget)}
    </section>
  );
}

// Sidebar: the other pages in this section, a phone number, and a shortcut.
function InfoSidebar({ page }) {
  const { pathname } = useLocation();
  const menu = MAIN_MENU.find((m) => page.eyebrow.startsWith(m.label));
  return (
    <aside className="info-aside" data-reveal="right">
      {menu && (
        <nav className="aside-card" aria-label={`More in ${menu.label}`}>
          <h2>More in {menu.label}</h2>
          <ul>
            {menu.links.map((l) => (
              <li key={l.to}>
                <Link to={l.to} aria-current={l.to === pathname ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="aside-card aside-dark">
        <h2>Questions?</h2>
        <p>
          <Icon name="phone" /> <a href={SHELTER.phoneHref}>{SHELTER.phone}</a>
        </p>
        <p>
          <Icon name="clock" /> {SHELTER.hours[0][0]}, {SHELTER.hours[0][1]}
        </p>
        <Link to="/animals" className="btn btn-cta btn-block">
          Meet the animals
        </Link>
      </div>
    </aside>
  );
}

export default function InfoPage({ slug }) {
  const page = INFO_PAGES[slug];
  useDocumentTitle(page?.title || 'Page not found');
  if (!page) return <NotFound />;

  return (
    <article className="info-page">
      <header className="page-banner">
        <div className="wrap">
          <p className="section-eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="page-banner-lede">{page.lede}</p>
        </div>
      </header>
      <div className="wrap info-layout">
        <div className="info-body">
          {page.sections.map((s) => (
            <Section key={s.heading} section={s} />
          ))}
          {page.cta && (
            <p className="info-cta">
              <Link to={page.cta.to} className="btn btn-cta btn-large">
                {page.cta.label}
                <Icon name="arrowRight" />
              </Link>
            </p>
          )}
        </div>
        <InfoSidebar page={page} />
      </div>
    </article>
  );
}
