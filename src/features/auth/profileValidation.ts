export type ProfileInput = {
  firstName: string;
  lastName: string;
  username: string;
  dateOfBirth: string;
};

export type ValidProfile = ProfileInput & { displayName: string };

export function validateProfile(input: ProfileInput): { profile?: ValidProfile; error?: string } {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const username = input.username.trim().toLowerCase();

  if (!firstName || !lastName) return { error: 'Enter your first and last name.' };
  if (firstName.length > 80 || lastName.length > 80) return { error: 'Keep each name under 80 characters.' };
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return { error: 'Use 3–20 letters, numbers, or underscores for your username.' };
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.dateOfBirth.trim());
  if (!match) return { error: 'Enter your date of birth as MM/DD/YYYY.' };
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  // UTC construction lets the round-trip checks reject impossible dates without local timezone shifts.
  const date = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  if (
    year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    year > today.getFullYear() ||
    (year === today.getFullYear() && month > today.getMonth() + 1) ||
    (year === today.getFullYear() && month === today.getMonth() + 1 && day >= today.getDate())
  ) return { error: 'Enter a valid date of birth before today.' };

  return {
    profile: {
      firstName,
      lastName,
      username,
      // Persist one sortable ISO form even though the form accepts a familiar US date.
      dateOfBirth: `${String(year).padStart(4, '0')}-${match[1]}-${match[2]}`,
      displayName: `${firstName} ${lastName}`,
    },
  };
}
