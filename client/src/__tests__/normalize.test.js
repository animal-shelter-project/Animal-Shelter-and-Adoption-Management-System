import { describe, expect, it } from 'vitest';
import { canApply } from '../constants.js';
import { formatAge, parseDate } from '../format.js';
import {
  canonicalAnimalStatus,
  canonicalRole,
  matchesFilters,
  normalizeAnimal,
  normalizeAnimals,
  normalizeApplication,
  safeImageUrl,
} from '../normalize.js';

describe('normalize (server-shape independence)', () => {
  it('T-N-1: maps _id or id to id', () => {
    expect(normalizeAnimal({ _id: 'abc', name: 'A' }).id).toBe('abc');
    expect(normalizeAnimal({ id: 7, name: 'B' }).id).toBe('7');
    expect(normalizeAnimal({ _id: { $oid: 'ff' }, name: 'C' }).id).toBe('ff');
  });

  it('T-N-2: accepts bare arrays and wrapped lists, drops items without an id', () => {
    expect(normalizeAnimals([{ id: 1 }])).toHaveLength(1);
    expect(normalizeAnimals({ animals: [{ id: 1 }, { id: 2 }] })).toHaveLength(2);
    expect(normalizeAnimals({ data: [{ id: 1 }] })).toHaveLength(1);
    expect(normalizeAnimals({ data: [{ name: 'no id' }] })).toHaveLength(0);
    expect(normalizeAnimals(null)).toEqual([]);
  });

  it('T-N-3: status variants map to the database values', () => {
    expect(canonicalAnimalStatus('available')).toBe('Available');
    expect(canonicalAnimalStatus('PENDING')).toBe('Pending');
    expect(canonicalAnimalStatus('Application Pending')).toBe('Pending'); // the plan's wording
    expect(canonicalAnimalStatus('application_pending')).toBe('Pending');
    expect(canonicalAnimalStatus(' adopted ')).toBe('Adopted');
    expect(canonicalAnimalStatus('fostered')).toBe('Fostered');
    expect(canonicalAnimalStatus('approved')).toBe('Approved');
    expect(canonicalAnimalStatus('Quarantine')).toBe('Quarantine'); // unknown: shown as-is
  });

  it('T-N-4: role casing is normalized', () => {
    expect(canonicalRole('staff')).toBe('Staff');
    expect(canonicalRole('ADOPTER')).toBe('Adopter');
  });

  it('T-N-5: only safe image URLs are kept', () => {
    expect(safeImageUrl('https://x.com/a.jpg')).toBe('https://x.com/a.jpg');
    expect(safeImageUrl('/uploads/a.jpg')).toBe('/uploads/a.jpg');
    expect(safeImageUrl('javascript:alert(1)')).toBeNull();
    expect(safeImageUrl('//evil.com/a.jpg')).toBeNull();
  });

  it('T-N-6: populated Mongo application references are flattened', () => {
    const app = normalizeApplication({ _id: 'a1', animalId: { _id: 'x9', name: 'Max' }, status: 'pending' });
    expect(app).toMatchObject({ id: 'a1', animalId: 'x9', animalName: 'Max', status: 'Pending' });
  });

  it('T-N-7: canApply only for Available, any casing', () => {
    expect(canApply({ status: 'available' })).toBe(true);
    expect(canApply({ status: 'Pending' })).toBe(false);
    expect(canApply({ status: 'Adopted' })).toBe(false);
    expect(canApply({ status: 'Fostered' })).toBe(false);
    expect(canApply(null)).toBe(false);
  });

  it('T-N-8: client-side filter safety net', () => {
    const a = normalizeAnimal({ id: 1, species: 'Dog', breed: 'Labrador Retriever', status: 'available' });
    expect(matchesFilters(a, { species: 'dog' })).toBe(true);
    expect(matchesFilters(a, { breed: 'LAB' })).toBe(true);
    expect(matchesFilters(a, { status: 'Available' })).toBe(true);
    expect(matchesFilters(a, { species: 'Cat' })).toBe(false);
  });
});

describe('formatAge', () => {
  it('T-F-1: years, months and free text', () => {
    expect(formatAge(1)).toBe('1 year');
    expect(formatAge(3.7)).toBe('3 years');
    expect(formatAge(0.5)).toBe('6 months');
    expect(formatAge('2')).toBe('2 years');
    expect(formatAge('8 weeks')).toBe('8 weeks');
    expect(formatAge(null, 1)).toBe('1 month');
    expect(formatAge(null)).toBeNull();
    expect(formatAge(-1)).toBeNull();
  });

  it('T-F-2: SQLite timestamps are read as UTC in every browser', () => {
    expect(parseDate('2026-10-12 15:00:00').toISOString()).toBe('2026-10-12T15:00:00.000Z');
    expect(parseDate('2026-10-12T15:00:00Z').toISOString()).toBe('2026-10-12T15:00:00.000Z');
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
});
