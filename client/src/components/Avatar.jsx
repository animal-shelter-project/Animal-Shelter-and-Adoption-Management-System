import { uploadUrl } from '../api.js';

// A person's profile picture, or their initials in a circle when they
// haven't added one. Decorative by default (the name is always written next
// to it); pass alt when the picture is shown on its own.
export default function Avatar({ name, email, photoUrl, size = 'small', alt = '' }) {
  const label = (name || email || '?').trim();
  const initials =
    label
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?';
  const src = uploadUrl(photoUrl);
  return (
    <span className={`avatar avatar-${size}`} aria-hidden={alt ? undefined : 'true'}>
      {src ? <img src={src} alt={alt} /> : <span className="avatar-initials">{initials}</span>}
    </span>
  );
}
