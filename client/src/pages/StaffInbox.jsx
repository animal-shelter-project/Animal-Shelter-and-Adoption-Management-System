import { useState } from 'react';
import { api } from '../api.js';
import Icon from '../components/Icon.jsx';
import { formatWhen } from '../format.js';
import { useDocumentTitle, useResource } from '../hooks.js';

// Staff inbox: foster and volunteer sign-ups and contact-form messages from
// the public site, plus the donation wish list (what is needed, who promised
// what). Staff mark each message Contacted or Closed once they have replied.

const TABS = [
  { key: 'Foster', label: 'Foster sign-ups' },
  { key: 'Volunteer', label: 'Volunteers' },
  { key: 'Contact', label: 'Messages' },
  { key: 'wishlist', label: 'Wish list' },
];
const STATUS_CLASS = { New: 'badge-pending', Contacted: 'badge-adopted', Closed: 'badge-neutral' };

function detailsLines(item) {
  const d = item.details || {};
  if (item.kind === 'Foster') {
    return [
      ['Could foster', (d.animals || []).join(', ')],
      ['For', d.length],
      ['Pets at home', d.hasOtherPets ? 'Yes' : 'No'],
    ];
  }
  if (item.kind === 'Volunteer') {
    return [
      ['Wants to help with', (d.interests || []).join(', ')],
      ['Free', (d.availability || []).join(', ')],
    ];
  }
  return [['Topic', d.topic]];
}

function InquiryList({ kind }) {
  const [show, setShow] = useState('New');
  const list = useResource(`inquiries:${kind}:${show}`, (signal) =>
    api.inquiries({ kind, status: show === 'All' ? undefined : show }, { signal }),
  );
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const setStatus = async (item, status) => {
    setBusyId(item.id);
    setError('');
    try {
      await api.setInquiryStatus(item.id, status);
      list.refresh();
    } catch (err) {
      setError(err.message || 'We couldn’t update that. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const items = list.data?.items;
  return (
    <div>
      <div className="tabs" role="group" aria-label="Show">
        {['New', 'Contacted', 'Closed', 'All'].map((s) => (
          <button key={s} type="button" className={`chip${show === s ? ' chip-active' : ''}`} aria-pressed={show === s} onClick={() => setShow(s)}>
            {s}
          </button>
        ))}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {list.error && !items && (
        <div className="notice error notice-row" role="alert">
          <span>{list.error.message}</span>
          <button type="button" className="btn" onClick={list.reload}>
            Retry
          </button>
        </div>
      )}
      {!items && !list.error && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="empty">Nothing here right now.</p>}
      {items?.length > 0 && (
        <ul className="inbox-list">
          {items.map((item) => (
            <li key={item.id} className="inbox-card" data-testid="inbox-item">
              <div className="inbox-head">
                <h3>{item.name}</h3>
                <span className={`badge ${STATUS_CLASS[item.status]}`}>{item.status}</span>
                <span className="muted small">{formatWhen(item.createdAt)}</span>
              </div>
              <p className="inbox-contact">
                <a href={`mailto:${item.email}`}>
                  <Icon name="mail" /> {item.email}
                </a>
                {item.phone && (
                  <a href={`tel:${item.phone}`}>
                    <Icon name="phone" /> {item.phone}
                  </a>
                )}
              </p>
              <dl className="inbox-details">
                {detailsLines(item)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
              {item.message && <p className="inbox-message">“{item.message}”</p>}
              <div className="actions">
                {item.status !== 'Contacted' && (
                  <button type="button" className="btn btn-primary btn-small" disabled={busyId === item.id} onClick={() => setStatus(item, 'Contacted')}>
                    Mark contacted
                  </button>
                )}
                {item.status !== 'Closed' && (
                  <button type="button" className="btn btn-ghost btn-small" disabled={busyId === item.id} onClick={() => setStatus(item, 'Closed')}>
                    Close
                  </button>
                )}
                {item.status !== 'New' && (
                  <button type="button" className="btn btn-ghost btn-small" disabled={busyId === item.id} onClick={() => setStatus(item, 'New')}>
                    Move back to New
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WishListAdmin() {
  const list = useResource('wishlist', (signal) => api.wishList({ signal }));
  const pledges = useResource('wishlist:pledges', (signal) => api.wishPledges({ signal }));
  const [drafts, setDrafts] = useState({}); // id -> needed (string while typing)
  const [message, setMessage] = useState(null);
  const [item, setItem] = useState({ name: '', category: 'Everyone', needed: '10' });

  const run = async (action, success) => {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'success', text: success });
      list.refresh();
      pledges.refresh();
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'We couldn’t save that. Please try again.' });
      return false;
    }
  };

  return (
    <div className="wish-admin">
      {message && (
        <p className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Wish-list items</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">For</th>
              <th scope="col">Promised</th>
              <th scope="col">Needed</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(list.data || []).map((w) => {
              const draft = drafts[w.id] ?? String(w.needed);
              return (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.category}</td>
                  <td>{w.pledged}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      className="needed-input"
                      aria-label={`Needed: ${w.name}`}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [w.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-small"
                        disabled={draft === String(w.needed)}
                        onClick={() => run(() => api.updateWishItem(w.id, { needed: Number(draft) }), `Saved ${w.name}.`)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-small btn-danger"
                        onClick={() => {
                          if (window.confirm?.(`Remove ${w.name} from the wish list?`) === false) return;
                          run(() => api.deleteWishItem(w.id), `Removed ${w.name}.`);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form
        className="form-card wish-add"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => api.addWishItem({ name: item.name, category: item.category, needed: Number(item.needed) }),
            `Added ${item.name.trim() || 'the item'}.`,
          ).then((ok) => ok && setItem((v) => ({ ...v, name: '' })));
        }}
      >
        <h2>Add an item</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="wish-name">Item</label>
            <input id="wish-name" type="text" maxLength={80} value={item.name} onChange={(e) => setItem((v) => ({ ...v, name: e.target.value }))} />
          </div>
          <div className="field">
            <label htmlFor="wish-cat">For</label>
            <select id="wish-cat" value={item.category} onChange={(e) => setItem((v) => ({ ...v, category: e.target.value }))}>
              <option>Dogs</option>
              <option>Cats</option>
              <option>Everyone</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="wish-needed">Needed</label>
            <input id="wish-needed" type="number" min={0} max={1000} value={item.needed} onChange={(e) => setItem((v) => ({ ...v, needed: e.target.value }))} />
          </div>
        </div>
        <button type="submit" className="btn btn-primary">
          Add to wish list
        </button>
      </form>

      <h2 className="staff-panel-sub">Promises (newest first)</h2>
      {pledges.data?.length === 0 && <p className="muted">No promises yet.</p>}
      {pledges.data?.length > 0 && (
        <ul className="record-list">
          {pledges.data.map((p) => (
            <li key={p.id}>
              <b>
                {p.quantity} × {p.itemName}
              </b>{' '}
              <span className="muted small">{formatWhen(p.createdAt)}</span>
              <p>
                {p.name} · <a href={`mailto:${p.email}`}>{p.email}</a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function StaffInbox() {
  useDocumentTitle('Inbox');
  const [tab, setTab] = useState('Foster');
  const counts = useResource('inquiries:counts', (signal) => api.inquiries({ status: 'New' }, { signal }));
  const newCounts = counts.data?.newCounts || {};

  return (
    <div className="page">
      <div className="page-head">
        <h1>Inbox</h1>
        <p className="muted">Sign-ups and messages from the public site, and the donation wish list.</p>
      </div>
      <div className="tabs inbox-tabs" role="tablist" aria-label="Inbox sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            className={`chip${tab === t.key ? ' chip-active' : ''}`}
            onClick={() => {
              setTab(t.key);
              counts.refresh();
            }}
          >
            {t.label}
            {newCounts[t.key] > 0 && <span className="count-badge">{newCounts[t.key]}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'wishlist' ? <WishListAdmin /> : <InquiryList key={tab} kind={tab} />}
      </div>
    </div>
  );
}
