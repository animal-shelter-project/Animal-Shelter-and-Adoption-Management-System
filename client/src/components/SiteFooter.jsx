import { Link } from 'react-router-dom';
import { MEGA_MENU, SHELTER } from '../siteContent.js';
import Icon from './Icon.jsx';

// Address, hours, phone and every main link, on every page.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <section className="footer-about" aria-labelledby="footer-visit">
          <p className="footer-brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="paw" />
            </span>
            {SHELTER.name}
          </p>
          <h2 id="footer-visit" className="footer-heading">
            Visit us
          </h2>
          <address>
            <p>
              <Icon name="pin" /> {SHELTER.street}, {SHELTER.city}
            </p>
            <p>
              <Icon name="phone" /> <a href={SHELTER.phoneHref}>{SHELTER.phone}</a>
            </p>
            <p>
              <Icon name="mail" /> <a href={`mailto:${SHELTER.email}`}>{SHELTER.email}</a>
            </p>
          </address>
          <h3 className="footer-subheading">Opening hours</h3>
          <dl className="hours">
            {SHELTER.hours.map(([days, time]) => (
              <div key={days}>
                <dt>{days}</dt>
                <dd>{time}</dd>
              </div>
            ))}
          </dl>
        </section>
        {MEGA_MENU.map((group) => (
          <nav key={group.heading} aria-label={`${group.heading} (footer)`} className="footer-col">
            <h2 className="footer-heading">{group.heading}</h2>
            <ul>
              {group.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="footer-base">
        <div className="wrap footer-base-inner">
          <p>
            © {new Date().getFullYear()} {SHELTER.name}. A class project for CSE 5324 at UT Arlington, not a real
            shelter.
          </p>
          <p>
            <Link to="/login">Staff login</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
