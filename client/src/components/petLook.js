// Colours and breed looks for the illustrated portraits (see PetArt.jsx).
// Kept out of the component file so React Fast Refresh keeps working
// (a component file should only export components).

export const INK = '#2B2340';
export const BLUSH = '#FF8FAB';

const COATS = {
  dog: [
    { coat: '#E9B464', ear: '#C98E3E', muzzle: '#FFF1DA' }, // golden
    { coat: '#8B5A3C', ear: '#5E3A24', muzzle: '#E8C9A8' }, // chocolate
    { coat: '#F2E6D8', ear: '#C9A27E', muzzle: '#FFFFFF' }, // cream
    { coat: '#4A4458', ear: '#2E2A38', muzzle: '#B9B2C6' }, // black
  ],
  cat: [
    { coat: '#9AA3AE', ear: '#7A838F', eye: '#7BC67E' }, // grey
    { coat: '#F0A35E', ear: '#D9843D', eye: '#7BC67E' }, // ginger
    { coat: '#4A4458', ear: '#2E2A38', eye: '#F2C94C' }, // black
    { coat: '#F4EDE4', ear: '#D8CBBB', eye: '#6FB7E9' }, // white
  ],
  rabbit: [
    { coat: '#D9B48F', ear: '#C29A73' },
    { coat: '#EDE6DF', ear: '#D3C6BA' },
    { coat: '#8E8078', ear: '#6F625B' },
  ],
};

// Breed keyword -> look. Checked in order, case-insensitive.
const BREEDS = [
  ['labrador', { coat: '#E9B464', ear: '#C98E3E', muzzle: '#FFF1DA' }],
  ['golden', { coat: '#E2A04F', ear: '#C27F2E', muzzle: '#FFE7C2' }],
  ['shepherd', { coat: '#C98A4B', ear: '#3B2F33', muzzle: '#E7C49C', mask: '#3B2F33' }],
  ['beagle', { coat: '#C7834A', ear: '#7A4A26', muzzle: '#FFFFFF', blaze: true }],
  ['husky', { coat: '#7D8794', ear: '#4F5763', muzzle: '#FFFFFF', blaze: true }],
  ['siamese', { coat: '#F3E3C8', ear: '#5A4033', eye: '#6FB7E9', points: '#5A4033' }],
  ['shorthair', { coat: '#9AA3AE', ear: '#7A838F', eye: '#7BC67E' }],
  ['maine coon', { coat: '#A9784F', ear: '#7E5534', eye: '#E3B341' }],
  ['lop', { coat: '#D9B48F', ear: '#C29A73', lop: true }],
];

function hash(value) {
  const s = String(value ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const BACKDROPS = ['#FFE7A0', '#FFD3E0', '#C8F0DC', '#CFE5FA', '#E3D9FB'];

// Colours come from the name (not the database id), so the Add Animal preview
// matches the saved animal exactly.
export function backdropFor(animal) {
  return BACKDROPS[hash(animal?.name ?? animal?.id) % BACKDROPS.length];
}

export function lookFor(animal, kind) {
  const breed = String(animal?.breed || '').toLowerCase();
  const match = BREEDS.find(([key]) => breed.includes(key));
  const base = COATS[kind] || COATS.dog;
  const fallback = base[hash(animal?.name ?? animal?.id) % base.length];
  return { ...fallback, ...(match ? match[1] : {}) };
}

export function speciesKind(species) {
  const s = String(species || '').toLowerCase();
  if (s.includes('dog') || s.includes('puppy')) return 'dog';
  if (s.includes('cat') || s.includes('kitten')) return 'cat';
  if (s.includes('rabbit') || s.includes('bunny')) return 'rabbit';
  return 'other';
}
