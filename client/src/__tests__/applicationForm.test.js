import { describe, expect, test } from 'vitest';
import { MAX_DETAILS, validateApplicationForm } from '../applicationForm.js';

// Proposal R-05 / US-05: validation for the adoption application form.
// v2: plus the structured questions.
const ANSWERED = {
  homeType: 'House', ownOrRent: 'Own', landlordOk: '', hasYard: 'yes',
  adults: '2', children: '0', otherPets: '', hoursAlone: '4',
};
const form = (householdDetails, extra = {}) => validateApplicationForm({ ...ANSWERED, householdDetails, ...extra });

describe('validateApplicationForm (proposal R-05)', () => {
  test('T-APPLY-UI-1: valid household details are accepted and trimmed', () => {
    const { fields, clean } = form('  Two adults, a yard.  ');
    expect(fields).toEqual({});
    expect(clean.householdDetails).toBe('Two adults, a yard.');
  });

  test('T-APPLY-UI-2: empty or blank details are rejected', () => {
    for (const value of ['', '   ', undefined]) {
      expect(form(value).fields.householdDetails).toBeTruthy();
    }
  });

  test('T-APPLY-UI-3: details over the limit are rejected', () => {
    expect(form('x'.repeat(MAX_DETAILS + 1)).fields.householdDetails).toMatch(/under/);
  });

  test('T-APPLY-UI-4: details at exactly the limit are accepted', () => {
    expect(form('x'.repeat(MAX_DETAILS)).fields).toEqual({});
  });

  test('T-APPLY-UI-5 (v2): the answers are turned into numbers and yes/no', () => {
    const { clean } = form('Home', { ownOrRent: 'Rent', landlordOk: 'yes', otherPets: ' One cat ' });
    expect(clean.answers).toEqual({
      homeType: 'House', ownOrRent: 'Rent', landlordOk: true, hasYard: true,
      adults: 2, children: 0, otherPets: 'One cat', hoursAlone: 4,
    });
  });

  test('T-APPLY-UI-6 (v2): every unanswered question is flagged; renters must answer about the landlord', () => {
    const { fields } = validateApplicationForm({ householdDetails: 'Home', ownOrRent: 'Rent' });
    expect(Object.keys(fields).sort()).toEqual(['adults', 'children', 'hasYard', 'homeType', 'hoursAlone', 'landlordOk']);
    expect(form('Home', { adults: '0', hoursAlone: '25' }).fields).toEqual({
      adults: 'At least 1 adult (up to 20).',
      hoursAlone: 'Enter 0 to 24 hours.',
    });
  });
});
