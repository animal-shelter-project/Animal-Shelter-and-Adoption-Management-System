import { useState } from 'react';
import PetArt from './PetArt.jsx';
import { backdropFor } from './petLook.js';

// Shows animal.photoUrl if the server provides a safe one (see
// normalize.safeImageUrl), otherwise an illustrated portrait on the
// animal's own pastel colour. A broken image URL falls back to the
// portrait instead of showing a broken-image icon.
export default function AnimalPhoto({ animal, large = false }) {
  // Remember WHICH url failed, so a new url gets a fresh try automatically.
  const [failedUrl, setFailedUrl] = useState(null);
  const cls = large ? 'photo photo-large' : 'photo';
  const style = { '--backdrop': backdropFor(animal) };

  if (animal.photoUrl && failedUrl !== animal.photoUrl) {
    return (
      <div className={cls} style={style}>
        <img
          src={animal.photoUrl}
          alt={`Photo of ${animal.name}`}
          loading="lazy"
          onError={() => setFailedUrl(animal.photoUrl)}
        />
      </div>
    );
  }
  return (
    <div className={`${cls} photo-fallback`} style={style} aria-hidden="true">
      <PetArt animal={animal} />
    </div>
  );
}
