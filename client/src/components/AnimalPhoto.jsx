import { useState } from 'react';

const EMOJI = { dog: '🐕', cat: '🐈', rabbit: '🐇', bird: '🐦' };

// Shows animal.photoUrl if the server provides a safe one (see
// normalize.safeImageUrl), otherwise a species tile. A broken image URL
// falls back to the tile instead of showing a broken-image icon.
export default function AnimalPhoto({ animal, large = false }) {
  // Remember WHICH url failed, so a new url gets a fresh try automatically.
  const [failedUrl, setFailedUrl] = useState(null);
  const cls = large ? 'photo photo-large' : 'photo';

  if (animal.photoUrl && failedUrl !== animal.photoUrl) {
    return (
      <img
        className={cls}
        src={animal.photoUrl}
        alt={`Photo of ${animal.name}`}
        loading="lazy"
        onError={() => setFailedUrl(animal.photoUrl)}
      />
    );
  }
  return (
    <div className={`${cls} photo-fallback`} aria-hidden="true">
      <span>{EMOJI[String(animal.species).toLowerCase()] || '🐾'}</span>
    </div>
  );
}
