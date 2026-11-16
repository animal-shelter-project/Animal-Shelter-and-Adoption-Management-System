import { uploadUrl } from '../api.js';

// Small home-photo thumbnails on an application; each opens the full photo
// in a new tab.
export default function HomePhotoLinks({ photos, who }) {
  if (!photos?.length) return null;
  return (
    <ul className="photo-thumbs photo-thumbs-small" aria-label={`Home photos from ${who}`}>
      {photos.map((p, i) => (
        <li key={p.id ?? p.url}>
          <a href={uploadUrl(p.url)} target="_blank" rel="noreferrer">
            <img src={uploadUrl(p.url)} alt={`Home photo ${i + 1} from ${who} (opens in a new tab)`} />
          </a>
        </li>
      ))}
    </ul>
  );
}
