// Validation for the adoption application form (proposal R-05 / US-05).
// Mirrors the checks in ApplicationController.submitApplication on the
// server, so most mistakes are caught before a request is sent; the server
// still checks everything and its field errors are shown the same way.

export const MAX_DETAILS = 1000;
export const MAX_OTHER_PETS = 300;
export const HOME_TYPES = ['House', 'Apartment', 'Condo', 'Mobile home', 'Other'];

// The form keeps every value as text ('' = not answered yet).
export const EMPTY_APPLICATION = {
  householdDetails: '',
  homeType: '',
  ownOrRent: '',
  landlordOk: '',
  hasYard: '',
  adults: '',
  children: '',
  otherPets: '',
  hoursAlone: '',
};

const tidy = (s) => String(s ?? '').trim();

function whole(values, key, min, max, message, fields, answers) {
  const text = tidy(values[key]);
  if (!/^\d+$/.test(text) || Number(text) < min || Number(text) > max) fields[key] = message;
  else answers[key] = Number(text);
}

// Returns { fields, clean } where clean = { householdDetails, answers }.
// fields is {} when everything is valid.
export function validateApplicationForm(values) {
  const fields = {};
  const answers = {};
  const clean = { answers };

  const details = tidy(values.householdDetails);
  if (!details) {
    fields.householdDetails = 'Tell us a little about your household.';
  } else if (details.length > MAX_DETAILS) {
    fields.householdDetails = `Keep this under ${MAX_DETAILS} characters.`;
  } else {
    clean.householdDetails = details;
  }

  // v2: structured questions.
  if (!HOME_TYPES.includes(values.homeType)) fields.homeType = 'Choose the type of home.';
  else answers.homeType = values.homeType;

  if (values.ownOrRent !== 'Own' && values.ownOrRent !== 'Rent') fields.ownOrRent = 'Choose own or rent.';
  else answers.ownOrRent = values.ownOrRent;

  if (values.ownOrRent === 'Rent') {
    if (values.landlordOk !== 'yes' && values.landlordOk !== 'no') fields.landlordOk = 'Does your landlord allow pets?';
    else answers.landlordOk = values.landlordOk === 'yes';
  } else {
    answers.landlordOk = null;
  }

  if (values.hasYard !== 'yes' && values.hasYard !== 'no') fields.hasYard = 'Do you have a fenced yard?';
  else answers.hasYard = values.hasYard === 'yes';

  whole(values, 'adults', 1, 20, 'At least 1 adult (up to 20).', fields, answers);
  whole(values, 'children', 0, 20, 'Enter 0 to 20.', fields, answers);
  whole(values, 'hoursAlone', 0, 24, 'Enter 0 to 24 hours.', fields, answers);

  const pets = tidy(values.otherPets);
  if (pets.length > MAX_OTHER_PETS) fields.otherPets = `Keep this under ${MAX_OTHER_PETS} characters.`;
  else answers.otherPets = pets;

  return { fields, clean };
}

// "House, own · fenced yard · 2 adults, 1 child · alone 4 h a day · Pets: one cat"
export function answersSummary(a) {
  if (!a) return '';
  const parts = [];
  if (a.homeType) {
    let home = `${a.homeType}${a.ownOrRent ? `, ${a.ownOrRent.toLowerCase()}` : ''}`;
    if (a.ownOrRent === 'Rent' && a.landlordOk != null) home += a.landlordOk ? ' (landlord OK)' : ' (landlord: no pets)';
    parts.push(home);
  }
  if (a.hasYard != null) parts.push(a.hasYard ? 'fenced yard' : 'no yard');
  if (a.adults != null) {
    const kids = a.children == null ? '' : `, ${a.children} ${a.children === 1 ? 'child' : 'children'}`;
    parts.push(`${a.adults} ${a.adults === 1 ? 'adult' : 'adults'}${kids}`);
  }
  if (a.hoursAlone != null) parts.push(`alone ${a.hoursAlone} h a day`);
  if (a.otherPets) parts.push(`Pets: ${a.otherPets}`);
  return parts.join(' · ');
}
