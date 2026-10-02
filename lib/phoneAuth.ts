const LOGIN_EMAIL_DOMAIN = 'psg-jobs.app';

/**
 * US phone → the email Supabase Auth stores for that employee.
 * Rob creates the user offline as `{10digits}@psg-jobs.app`.
 * Sign-in still uses email + password (`signInWithPassword`).
 */
export function phoneToLoginEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) {
    throw new Error('Enter a 10-digit US phone number.');
  }
  return `${national}@${LOGIN_EMAIL_DOMAIN}`;
}
