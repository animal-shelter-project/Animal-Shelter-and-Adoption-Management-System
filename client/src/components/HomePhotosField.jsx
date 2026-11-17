import { useRef } from 'react';
import { PHOTO_TYPES } from '../photo.js';

const MAX_HOME_PHOTOS = 3;

const preview = (file) =>
  typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;

// Optional photos of the adopter's home or yard on an adoption application
// (up to 3). photos = [{ key, file, preview }]; the files are read and sent
// when the form is submitted.
export default function HomePhotosField({ photos, onChange, error }) {
  const input = useRef(null);
  const left = MAX_HOME_PHOTOS - photos.length;

  const add = (e) => {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    const ok = chosen.filter((f) => PHOTO_TYPES.includes(f.type)).slice(0, left);
    onChange(
      [...photos, ...ok.map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: preview(file) }))],
      chosen.length > ok.length
        ? chosen.some((f) => !PHOTO_TYPES.includes(f.type))
          ? 'Choose JPEG, PNG or WebP photos.'
          : `You can add up to ${MAX_HOME_PHOTOS} photos.`
        : '',
    );
  };

  const remove = (photo) => {
    if (photo.preview) URL.revokeObjectURL?.(photo.preview);
    onChange(photos.filter((p) => p !== photo), '');
  };

  return (
    <fieldset className="field home-photos">
      <legend>Photos of your home (optional)</legend>
      <p className="muted small" id="application-homePhotos-hint">
        Up to {MAX_HOME_PHOTOS} photos of where the animal would live, such as the living room or the yard and its fence. Only shelter
        staff see them.
      </p>
      {photos.length > 0 && (
        <ul className="photo-thumbs">
          {photos.map((p, i) => (
            <li key={p.key}>
              {p.preview && <img src={p.preview} alt="" />}
              <span className="thumb-name">{p.file.name}</span>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => remove(p)} aria-label={`Remove home photo ${i + 1}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        id="application-homePhotos-file"
        type="file"
        multiple
        accept={PHOTO_TYPES.join(',')}
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Home photo files"
        data-testid="home-photos-input"
        onChange={add}
      />
      {left > 0 && (
        <button type="button" id="application-homePhotos" className="btn" aria-describedby="application-homePhotos-hint" onClick={() => input.current?.click()}>
          {photos.length ? `Add another photo (${left} left)` : 'Add photos'}
        </button>
      )}
      {error && (
        <span className="field-error" id="application-homePhotos-error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}
