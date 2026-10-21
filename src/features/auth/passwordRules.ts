// The set of password rules enforced when a user creates one.
export const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (value: string) => value.length >= 8 },
  { label: 'One uppercase letter', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'One number or symbol', test: (value: string) => /[^A-Za-z]/.test(value) },
];
