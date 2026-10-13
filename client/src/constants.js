import { ANIMAL_STATUS, canonicalAnimalStatus } from './normalize.js';

// Status filter options: every value the database allows
// (CHECK constraint in server/src/db.js).
export const STATUSES = [
  ANIMAL_STATUS.AVAILABLE,
  ANIMAL_STATUS.PENDING,
  ANIMAL_STATUS.ADOPTED,
  ANIMAL_STATUS.FOSTERED,
];

// Default species options. Any other species found in the data is added to
// the dropdown automatically, so a new species never becomes unfilterable.
export const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'];

// Only Available animals can be applied for (US-02 / T-UI-1).
// Case-insensitive so "available" from the server still works.
export const canApply = (animal) =>
  canonicalAnimalStatus(animal?.status) === ANIMAL_STATUS.AVAILABLE;
