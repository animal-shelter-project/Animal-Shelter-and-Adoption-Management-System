import { ANIMAL_STATUS, canonicalAnimalStatus } from './normalize.js';

// Status filter options: every value the database allows
// (CHECK constraint in server/src/db.js).
export const STATUSES = [
  ANIMAL_STATUS.AVAILABLE,
  ANIMAL_STATUS.PENDING,
  ANIMAL_STATUS.ADOPTED,
  ANIMAL_STATUS.FOSTERED,
];

// The browse page shows Available animals unless the visitor picks another
// status (proposal R-02 / US-02). "all" in the URL means every status.
export const DEFAULT_STATUS = ANIMAL_STATUS.AVAILABLE;
export const ALL_STATUSES = 'all';

// Age filter groups live in format.js (next to the age parsing).
export { AGE_GROUPS } from './format.js';

// Status changes staff can make by hand (proposal R-09 / R-12). Mirrors
// allowedManualChanges in server/src/services/AnimalStatusService.js.
// Pending is left to the application workflow (submit / approve / reject).
export const MANUAL_STATUS_CHANGES = {
  [ANIMAL_STATUS.AVAILABLE]: [ANIMAL_STATUS.FOSTERED, ANIMAL_STATUS.ADOPTED],
  [ANIMAL_STATUS.FOSTERED]: [ANIMAL_STATUS.AVAILABLE, ANIMAL_STATUS.ADOPTED],
  [ANIMAL_STATUS.ADOPTED]: [ANIMAL_STATUS.AVAILABLE],
  [ANIMAL_STATUS.PENDING]: [],
};

// Default species options. Any other species found in the data is added to
// the dropdown automatically, so a new species never becomes unfilterable.
export const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'];

// Only Available animals can be applied for (US-02 / T-UI-1).
// Case-insensitive so "available" from the server still works.
export const canApply = (animal) =>
  canonicalAnimalStatus(animal?.status) === ANIMAL_STATUS.AVAILABLE;
