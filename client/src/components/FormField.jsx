// A labelled input with its error message under it, wired for screen
// readers (aria-invalid + aria-describedby). Used by the v2 account pages.
//   <FormField id="reg-email" label="Email" error={errors.email} type="email" value=… onChange=… />
export default function FormField({ id, label, error, hint, as = 'input', ...props }) {
  const Input = as;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint && (
        <span className="muted small" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
