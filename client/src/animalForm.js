// Validation for the Add and Edit Animal forms (proposal R-01 / US-01).
// Mirrors the server's checks (server/src/controllers/AnimalController.js), so
// most mistakes are caught before a request is sent; the server still checks
// everything and its field errors are shown the same way.

export const TEXT_LIMITS = { name: 60, species: 40, breed: 60, description: 1000 };
export const MAX_AGE = 40;
export const MAX_FEE = 10000;
export const OTHER_SPECIES = 'Other';
export const SEXES = ['Unknown', 'Male', 'Female'];
export const SIZES = ['Small', 'Medium', 'Large'];

// The form keeps every value as text; "" means "not known" for the
// good-with questions.
export const EMPTY_DETAILS = {
  ageMonths: '',
  sex: 'Unknown',
  size: '',
  description: '',
  goodWithKids: '',
  goodWithDogs: '',
  goodWithCats: '',
  adoptionFee: '',
};

const tidy = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const yesNoToValue = (v) => (v === 'yes' ? true : v === 'no' ? false : null);
export const yesNoToForm = (v) => (v === true ? 'yes' : v === false ? 'no' : '');

// values: { name, species, otherSpecies, breed, age, ageMonths, sex, size,
//           description, goodWithKids, goodWithDogs, goodWithCats, adoptionFee, status }
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

  const months = String(values.ageMonths ?? '').trim();
  if (!months) clean.ageMonths = 0;
  else if (!/^\d+$/.test(months) || Number(months) > 11) fields.ageMonths = 'Months must be 0 to 11.';
  else clean.ageMonths = Number(months);

  const fee = String(values.adoptionFee ?? '').trim().replace(/^\$/, '');
  if (!fee) clean.adoptionFee = 0;
  else if (!/^\d+$/.test(fee)) fields.adoptionFee = 'Fee must be a whole number of dollars.';
  else if (Number(fee) > MAX_FEE) fields.adoptionFee = `Fee must be $${MAX_FEE.toLocaleString('en-US')} or less.`;
  else clean.adoptionFee = Number(fee);

  const description = String(values.description ?? '').trim();
  if (description.length > TEXT_LIMITS.description) {
    fields.description = `Keep the description under ${TEXT_LIMITS.description} characters.`;
  } else {
    clean.description = description;
  }

  clean.sex = SEXES.includes(values.sex) ? values.sex : 'Unknown';
  clean.size = SIZES.includes(values.size) ? values.size : '';
  clean.goodWithKids = yesNoToValue(values.goodWithKids);
  clean.goodWithDogs = yesNoToValue(values.goodWithDogs);
  clean.goodWithCats = yesNoToValue(values.goodWithCats);

  clean.status = values.status || 'Available';
  return { fields, clean };
}
