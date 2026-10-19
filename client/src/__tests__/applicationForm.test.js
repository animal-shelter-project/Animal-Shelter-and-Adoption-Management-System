import { describe, expect, test } from 'vitest';
import { MAX_DETAILS, validateApplicationForm } from '../applicationForm.js';

// Proposal R-05 / US-05: validation for the adoption application form.
describe('validateApplicationForm (proposal R-05)', () => {
  test('T-APPLY-UI-1: valid household details are accepted and trimmed', () => {
    const { fields, clean } = validateApplicationForm({ householdDetails: '  Two adults, a yard.  ' });
    expect(fields).toEqual({});
    expect(clean.householdDetails).toBe('Two adults, a yard.');
  });

  test('T-APPLY-UI-2: empty or blank details are rejected', () => {
    for (const value of ['', '   ', undefined]) {
      const { fields } = validateApplicationForm({ householdDetails: value });
      expect(fields.householdDetails).toBeTruthy();
    }
  });

  test('T-APPLY-UI-3: details over the limit are rejected', () => {
    const { fields } = validateApplicationForm({ householdDetails: 'x'.repeat(MAX_DETAILS + 1) });
    expect(fields.householdDetails).toMatch(/under/);
  });

  test('T-APPLY-UI-4: details at exactly the limit are accepted', () => {
    const { fields } = validateApplicationForm({ householdDetails: 'x'.repeat(MAX_DETAILS) });
    expect(fields).toEqual({});
  });
});