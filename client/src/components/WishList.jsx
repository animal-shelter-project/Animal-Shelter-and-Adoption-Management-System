import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useResource } from '../hooks.js';
import Icon from './Icon.jsx';

// The donation wish list: each item shows a progress bar of how much has
// been promised. "I'll bring some" opens a small form right on the card.
// No payments: people bring the items to the shelter.

const CATEGORIES = ['All', 'Dogs', 'Cats', 'Everyone'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Progress({ item }) {
  const pct = item.needed ? Math.min(100, Math.round((item.pledged / item.needed) * 100)) : 100;
  return (
    <div className="progress-wrap">
      <div
        className="progress"
        role="progressbar"
        aria-label={`${item.name}: ${item.pledged} of ${item.needed} promised`}
        aria-valuemin={0}
        aria-valuemax={item.needed}
        aria-valuenow={Math.min(item.pledged, item.needed)}
      >
        <span className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-text">
        <strong>{item.pledged}</strong> of {item.needed} promised
        {item.remaining > 0 ? ` · ${item.remaining} still needed` : ' · fully covered, thank you!'}
      </p>
    </div>
  );
}

function PledgeForm({ item, onDone, onCancel }) {
  const [values, setValues] = useState({ name: '', email: '', quantity: 1 });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const id = (k) => `pledge-${item.id}-${k}`;
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const qty = Number(values.quantity);
  const step = (d) => setValues((v) => ({ ...v, quantity: Math.min(item.remaining, Math.max(1, Number(v.quantity) + d)) }));

  const submit = async (e) => {
    e.preventDefault();
    const problems = {};
    if (!values.name.trim()) problems.name = 'Enter your name.';
    if (!EMAIL.test(values.email.trim())) problems.email = 'Enter a valid email address.';
    if (!Number.isInteger(qty) || qty < 1 || qty > item.remaining) problems.quantity = `Choose 1 to ${item.remaining}.`;
    setErrors(problems);
    setError('');
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      const updated = await api.pledge(item.id, { name: values.name.trim(), email: values.email.trim(), quantity: qty });
      onDone(updated, qty);
    } catch (err) {
      setErrors(err.body?.fields || {});
      setError(err.message || 'We couldn’t save that. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pledge-form" onSubmit={submit} noValidate aria-label={`Promise to bring ${item.name}`}>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="field">
        <label htmlFor={id('qty')}>How many will you bring?</label>
        <div className="stepper">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => step(-1)} disabled={qty <= 1}>
            <Icon name="minus" label="One fewer" />
          </button>
          <input
            id={id('qty')}
            type="number"
            min={1}
            max={item.remaining}
            value={values.quantity}
            onChange={set('quantity')}
            aria-invalid={Boolean(errors.quantity)}
          />
          <button type="button" className="btn btn-ghost btn-small" onClick={() => step(1)} disabled={qty >= item.remaining}>
            <span aria-hidden="true">+</span>
            <span className="visually-hidden">One more</span>
          </button>
        </div>
        {errors.quantity && <span className="field-error">{errors.quantity}</span>}
      </div>
      <div className="field">
        <label htmlFor={id('name')}>Your name</label>
        <input id={id('name')} type="text" autoComplete="name" maxLength={80} value={values.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>
      <div className="field">
        <label htmlFor={id('email')}>Email</label>
        <input id={id('email')} type="email" autoComplete="email" maxLength={120} value={values.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>
      <div className="actions">
        <button type="submit" className="btn btn-cta" disabled={saving}>
          {saving ? 'Saving…' : 'Promise to bring'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function WishList() {
  const list = useResource('wishlist', (signal) => api.wishList({ signal }));
  const [category, setCategory] = useState('All');
  const [openId, setOpenId] = useState(null);
  const [thanks, setThanks] = useState(null);
  const [updates, setUpdates] = useState({}); // item id -> latest totals after a pledge

  if (list.error && !list.data) {
    return (
      <p className="notice error" role="alert">
        We couldn’t load the wish list. <button type="button" className="link-button" onClick={list.reload}>Retry</button>
      </p>
    );
  }
  if (!list.data) return <p className="muted">Loading the wish list…</p>;
  const items = list.data.map((i) => updates[i.id] || i);
  const shown = category === 'All' ? items : items.filter((i) => i.category === category);
  const totalNeeded = items.reduce((n, i) => n + i.needed, 0);
  const totalPledged = items.reduce((n, i) => n + Math.min(i.pledged, i.needed), 0);

  return (
    <div className="wishlist">
      <div className="wish-summary" data-reveal="up">
        <p>
          <strong>{totalPledged}</strong> of <strong>{totalNeeded}</strong> items promised so far
        </p>
        <Progress item={{ name: 'Whole wish list', needed: totalNeeded, pledged: totalPledged, remaining: totalNeeded - totalPledged }} />
      </div>
      <div className="tabs" role="group" aria-label="Show items for">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${category === c ? ' chip-active' : ''}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {thanks && (
        <p className="notice notice-success" role="status">
          {thanks}
        </p>
      )}
      <ul className="wish-grid">
        {shown.map((item) => (
          <li key={item.id} className={`wish-card${item.remaining === 0 ? ' is-done' : ''}`} data-reveal="up">
            <div className="wish-head">
              <span className="wish-cat">{item.category}</span>
              <h3>{item.name}</h3>
            </div>
            <Progress item={item} />
            {openId === item.id ? (
              <PledgeForm
                item={item}
                onCancel={() => setOpenId(null)}
                onDone={(updated, qty) => {
                  setUpdates((u) => ({ ...u, [item.id]: updated }));
                  setOpenId(null);
                  setThanks(`Thank you! We’ve noted ${qty} × ${item.name.toLowerCase()}. Drop them off any time we’re open.`);
                }}
              />
            ) : item.remaining > 0 ? (
              <button type="button" className="btn btn-outline" onClick={() => { setOpenId(item.id); setThanks(null); }}>
                <Icon name="gift" /> I’ll bring some
              </button>
            ) : (
              <p className="wish-done">
                <Icon name="check" /> All covered
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Bring items to the front desk during <Link to="/contact">opening hours</Link>. This site never takes payments.
      </p>
    </div>
  );
}

// The three items furthest from their goal, for the "Ways to give" page.
export function WishPreview() {
  const list = useResource('wishlist', (signal) => api.wishList({ signal }));
  if (!list.data?.length) return null;
  const top = [...list.data]
    .filter((i) => i.remaining > 0)
    .sort((a, b) => b.remaining / b.needed - a.remaining / a.needed)
    .slice(0, 3);
  return (
    <ul className="wish-grid wish-grid-small">
      {top.map((item) => (
        <li key={item.id} className="wish-card" data-reveal="up">
          <div className="wish-head">
            <span className="wish-cat">{item.category}</span>
            <h3>{item.name}</h3>
          </div>
          <Progress item={item} />
          <Link to="/donate/wish-list" className="text-link">
            Promise to bring some <Icon name="arrowRight" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
