// Validation for the Add Animal form (proposal R-01 / US-01).
// Mirrors the server's validateNewAnimal (server/src/utils/validation.js), so
// most mistakes are caught before a request is sent; the server still checks
// everything and its field errors are shown the same way.

export const TEXT_LIMITS = { name: 60, species: 40, breed: 60 };
export const MAX_AGE = 40;
export const OTHER_SPECIES = 'Other';

const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

// values: { name, species, otherSpecies, breed, age, status }
// Returns { fields, clean }. fields is {} when everything is valid.
export function validateAnimalForm(values) {
  const fields = {};
  const clean = {};

  const species = values.species === OTHER_SPECIES ? values.otherSpecies : values.species;
  for (const [key, label, value] of [
    ['name', 'Name', values.name],
    ['species', 'Species', species],
    ['breed', 'Breed', values.breed],
  ]) {
    const text = tidy(value);
    if (!text) {
      fields[key] =
        key === 'species' && values.species === OTHER_SPECIES ? 'Type the species.' : `${label} is required.`;
    } else if (text.length > TEXT_LIMITS[key]) {
      fields[key] = `${label} must be ${TEXT_LIMITS[key]} characters or fewer.`;
    } else {
      clean[key] = text;
    }
  }

  const age = String(values.age ?? '').trim();
  if (!age) fields.age = 'Age is required.';
  else if (!/^\d+$/.test(age)) fields.age = 'Age must be a whole number of years, 0 or more.';
  else if (Number(age) > MAX_AGE) fields.age = `Age must be ${MAX_AGE} or less.`;
  else clean.age = Number(age);

  clean.status = values.status || 'Available';
  return { fields, clean };
}
