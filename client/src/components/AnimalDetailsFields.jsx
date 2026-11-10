import { useEffect, useState } from 'react';
import { api, isAbort } from '../api.js';
import { MAX_FEE, SEXES, SIZES, TEXT_LIMITS } from '../animalForm.js';

// Fields shared by the Add Animal and Edit Animal forms (v2): breed with
// suggestions, age in years and months, sex, size, good with kids / dogs /
// cats, adoption fee and description.
//
// props: values, set(key) -> onChange handler, errors, fieldProps(key)

export function FieldError({ name, errors }) {
  if (!errors[name]) return null;
  return (
    <span className="field-error" id={`animal-${name}-error`}>
      {errors[name]}
    </span>
  );
}

// Breed text box with the breeds already used for this species as
// suggestions, so the same breed isn't typed three different ways.
export function BreedField({ values, set, errors, fieldProps, species }) {
  const [breeds, setBreeds] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    api
      .breeds(species, { signal: controller.signal })
      .then(setBreeds)
      .catch((err) => {
        if (!isAbort(err)) setBreeds([]); // suggestions are optional
      });
    return () => controller.abort();
  }, [species]);

  return (
    <div className="field">
      <label htmlFor="animal-breed">Breed</label>
      <input
        {...fieldProps('breed')}
        type="text"
        list="animal-breed-options"
        autoComplete="off"
        placeholder="e.g. Labrador Retriever, or Mixed"
        maxLength={TEXT_LIMITS.breed}
        value={values.breed}
        onChange={set('breed')}
      />
      <datalist id="animal-breed-options">
        {breeds.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <FieldError name="breed" errors={errors} />
    </div>
  );
}

const YES_NO = [
  ['', 'Not known'],
  ['yes', 'Yes'],
  ['no', 'No'],
];

export default function AnimalDetailsFields({ values, set, errors, fieldProps }) {
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label htmlFor="animal-age">Age (years)</label>
          <input
            {...fieldProps('age')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            placeholder="0 for under a year"
            value={values.age}
            onChange={set('age')}
          />
          <FieldError name="age" errors={errors} />
        </div>
        <div className="field">
          <label htmlFor="animal-ageMonths">and months</label>
          <input
            {...fieldProps('ageMonths')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={2}
            placeholder="0 to 11"
            value={values.ageMonths}
            onChange={set('ageMonths')}
          />
          <FieldError name="ageMonths" errors={errors} />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="animal-sex">Sex</label>
          <select {...fieldProps('sex')} value={values.sex} onChange={set('sex')}>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {s === 'Unknown' ? 'Not known' : s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="animal-size">Size</label>
          <select {...fieldProps('size')} value={values.size} onChange={set('size')}>
            <option value="">Not known</option>
            {SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="animal-adoptionFee">Adoption fee ($)</label>
          <input
            {...fieldProps('adoptionFee')}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={String(MAX_FEE).length + 1}
            placeholder="0 for no fee"
            value={values.adoptionFee}
            onChange={set('adoptionFee')}
          />
          <FieldError name="adoptionFee" errors={errors} />
        </div>
      </div>

      <fieldset className="field good-with">
        <legend>Good with</legend>
        <div className="field-row">
          {[
            ['goodWithKids', 'Children'],
            ['goodWithDogs', 'Dogs'],
            ['goodWithCats', 'Cats'],
          ].map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={`animal-${key}`}>{label}</label>
              <select {...fieldProps(key)} value={values[key]} onChange={set(key)}>
                {YES_NO.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="animal-description">About this animal</label>
        <textarea
          {...fieldProps('description')}
          rows={4}
          maxLength={TEXT_LIMITS.description}
          placeholder="Personality, habits, what kind of home would suit them…"
          value={values.description}
          onChange={set('description')}
        />
        <span className="muted small">
          {values.description.length}/{TEXT_LIMITS.description}
        </span>
        <FieldError name="description" errors={errors} />
      </div>
    </>
  );
}
