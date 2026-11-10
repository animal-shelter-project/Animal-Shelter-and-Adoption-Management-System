import { useRef, useState } from 'react';
import { api } from '../api.js';

// Staff tools on an animal's profile (v2): add or change its photo, remove
// it, and archive the animal (hide it from the catalog) or restore it.
//
// Photos: JPEG, PNG or WebP. A file over 2 MB is shrunk in the browser
// (longest side 1600 px, JPEG) before upload when the browser can.

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(blob);
  });

// Shrinks a large photo. Resolves to a Blob, or null if the browser can't.
async function shrink(file) {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch {
    return null;
  }
}

export async function photoToDataUrl(file) {
  if (!TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  let blob = file;
  if (file.size > MAX_PHOTO_BYTES) {
    blob = await shrink(file);
    if (!blob || blob.size > MAX_PHOTO_BYTES) throw new Error('Photos must be 2 MB or smaller.');
  }
  return readAsDataUrl(blob);
}

export default function StaffAnimalTools({ animal, onChanged }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // { kind: 'success' | 'error', text }

  const run = async (label, action, success) => {
    setBusy(label);
    setMessage(null);
    try {
      const updated = await action();
      setMessage({ kind: 'success', text: success(updated) });
      onChanged?.(updated);
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // choosing the same file again still triggers
    if (!file) return;
    run(
      'photo',
      async () => api.uploadAnimalPhoto(animal.id, await photoToDataUrl(file)),
      () => `New photo saved for ${animal.name}.`,
    );
  };

  const archive = () => {
    const ok = window.confirm?.(
      `Archive ${animal.name}? They will be hidden from the catalog. Their history is kept and you can restore them later.`,
    );
    if (ok === false) return;
    run('archive', () => api.archiveAnimal(animal.id), () => `${animal.name} was archived.`);
  };

  return (
    <section className="staff-panel staff-tools" aria-labelledby="staff-tools-title">
      <h2 id="staff-tools-title">Staff tools</h2>
      {message && (
        <div
          className={`notice ${message.kind === 'error' ? 'error' : 'notice-success'}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </div>
      )}
      <div className="actions">
        <input
          ref={fileInput}
          type="file"
          accept={TYPES.join(',')}
          className="visually-hidden"
          aria-label={`Photo of ${animal.name}`}
          data-testid="photo-input"
          onChange={onFile}
        />
        <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}>
          {busy === 'photo' ? 'Uploading…' : animal.photoUrl ? 'Change photo' : 'Add a photo'}
        </button>
        {animal.photoUrl && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={Boolean(busy)}
            onClick={() =>
              run('remove', () => api.removeAnimalPhoto(animal.id), () => 'Photo removed.')
            }
          >
            Remove photo
          </button>
        )}
        {animal.archived ? (
          <button
            type="button"
            className="btn"
            disabled={Boolean(busy)}
            onClick={() =>
              run('restore', () => api.restoreAnimal(animal.id), () => `${animal.name} is back in the catalog.`)
            }
          >
            Restore to catalog
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={archive}>
            Archive animal
          </button>
        )}
      </div>
      <p className="muted small">Photos: JPEG, PNG or WebP. Large photos are shrunk automatically.</p>
    </section>
  );
}
