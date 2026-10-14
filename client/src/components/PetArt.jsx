// Friendly illustrated portrait for an animal that has no photo.
// The look follows the breed where we know it (a golden Lab, a Siamese with
// dark points and blue eyes, a Holland Lop with floppy ears); otherwise the
// coat colour is picked from the animal's id, so each animal keeps the same
// portrait every time. Purely decorative: always aria-hidden, no text inside
// (so screen readers and text searches only see the animal's real name).

import { INK, BLUSH, lookFor, speciesKind } from './petLook.js';

const Eye = ({ x, y, r = 7 }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={INK} />
    <circle cx={x + r * 0.35} cy={y - r * 0.4} r={r * 0.32} fill="#fff" />
  </g>
);

function Dog({ look }) {
  return (
    <g>
      <ellipse cx="52" cy="92" rx="22" ry="40" fill={look.ear} transform="rotate(18 52 92)" />
      <ellipse cx="148" cy="92" rx="22" ry="40" fill={look.ear} transform="rotate(-18 148 92)" />
      <ellipse cx="100" cy="108" rx="56" ry="54" fill={look.coat} />
      {look.mask && <path d="M47 104 Q46 56 100 54 Q154 56 153 104 Q140 84 122 86 Q110 74 100 90 Q90 74 78 86 Q60 84 47 104Z" fill={look.mask} />}
      {look.blaze && <path d="M92 58 Q100 52 108 58 L112 118 L88 118Z" fill={look.muzzle} />}
      <ellipse cx="100" cy="134" rx="32" ry="24" fill={look.muzzle} />
      <Eye x={78} y={100} />
      <Eye x={122} y={100} />
      <ellipse cx="100" cy="122" rx="12" ry="8.5" fill={INK} />
      <path d="M100 130 v8 M100 138 q-9 9 -17 2 M100 138 q9 9 17 2" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M94 144 q6 14 12 0Z" fill={BLUSH} />
      <circle cx="66" cy="124" r="7" fill={BLUSH} opacity="0.45" />
      <circle cx="134" cy="124" r="7" fill={BLUSH} opacity="0.45" />
    </g>
  );
}

function Cat({ look }) {
  return (
    <g>
      <path d="M50 92 L58 32 L96 66Z" fill={look.points || look.ear} />
      <path d="M150 92 L142 32 L104 66Z" fill={look.points || look.ear} />
      <path d="M60 78 L63 46 L84 66Z" fill={BLUSH} opacity="0.7" />
      <path d="M140 78 L137 46 L116 66Z" fill={BLUSH} opacity="0.7" />
      <ellipse cx="100" cy="112" rx="60" ry="52" fill={look.coat} />
      {look.points && <ellipse cx="100" cy="124" rx="30" ry="24" fill={look.points} opacity="0.75" />}
      <ellipse cx="78" cy="104" rx="10" ry="11" fill={look.eye || '#7BC67E'} />
      <ellipse cx="122" cy="104" rx="10" ry="11" fill={look.eye || '#7BC67E'} />
      <ellipse cx="78" cy="105" rx="3.6" ry="8" fill={INK} />
      <ellipse cx="122" cy="105" rx="3.6" ry="8" fill={INK} />
      <circle cx="81" cy="99" r="2.4" fill="#fff" />
      <circle cx="125" cy="99" r="2.4" fill="#fff" />
      <path d="M93 121 h14 l-7 8Z" fill={BLUSH} />
      <path d="M100 129 q-6 8 -13 3 M100 129 q6 8 13 3" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M70 124 h-30 M70 131 l-28 6 M130 124 h30 M130 131 l28 6" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </g>
  );
}

function Rabbit({ look }) {
  const ears = look.lop ? (
    <>
      <ellipse cx="50" cy="118" rx="18" ry="44" fill={look.ear} transform="rotate(14 50 118)" />
      <ellipse cx="150" cy="118" rx="18" ry="44" fill={look.ear} transform="rotate(-14 150 118)" />
    </>
  ) : (
    <>
      <ellipse cx="80" cy="46" rx="15" ry="42" fill={look.coat} transform="rotate(-8 80 46)" />
      <ellipse cx="120" cy="46" rx="15" ry="42" fill={look.coat} transform="rotate(8 120 46)" />
      <ellipse cx="80" cy="50" rx="7" ry="30" fill={BLUSH} opacity="0.6" transform="rotate(-8 80 50)" />
      <ellipse cx="120" cy="50" rx="7" ry="30" fill={BLUSH} opacity="0.6" transform="rotate(8 120 50)" />
    </>
  );
  return (
    <g>
      {!look.lop && ears}
      <circle cx="100" cy="116" r="52" fill={look.coat} />
      {look.lop && ears}
      <Eye x={80} y={110} r={6.5} />
      <Eye x={120} y={110} r={6.5} />
      <ellipse cx="100" cy="126" rx="6" ry="4.5" fill={BLUSH} />
      <path d="M100 131 v5 M100 136 q-6 6 -11 1 M100 136 q6 6 11 1" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <rect x="94" y="140" width="12" height="9" rx="2" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <circle cx="70" cy="128" r="7" fill={BLUSH} opacity="0.45" />
      <circle cx="130" cy="128" r="7" fill={BLUSH} opacity="0.45" />
    </g>
  );
}

function Paw() {
  return (
    <g fill={INK} opacity="0.85">
      <ellipse cx="100" cy="124" rx="30" ry="25" />
      <ellipse cx="66" cy="90" rx="11" ry="14" />
      <ellipse cx="88" cy="74" rx="11" ry="14" />
      <ellipse cx="112" cy="74" rx="11" ry="14" />
      <ellipse cx="134" cy="90" rx="11" ry="14" />
    </g>
  );
}

export default function PetArt({ animal, className = '' }) {
  const kind = speciesKind(animal?.species);
  const look = lookFor(animal, kind === 'other' ? 'dog' : kind);
  return (
    <svg
      className={`pet-art ${className}`.trim()}
      viewBox="0 0 200 180"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'dog' && <Dog look={look} />}
      {kind === 'cat' && <Cat look={look} />}
      {kind === 'rabbit' && <Rabbit look={look} />}
      {kind === 'other' && <Paw />}
    </svg>
  );
}
