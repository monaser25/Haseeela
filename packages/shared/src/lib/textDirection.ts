const arabicPattern = /[\u0600-\u06FF]/;
const latinPattern = /[A-Za-z0-9@._-]/;

export function isLatinToken(value: string | null | undefined) {
  if (!value) return false;
  return latinPattern.test(value) && !arabicPattern.test(value);
}

export function latinTokenClass(value: string | null | undefined) {
  return isLatinToken(value) ? 'ltr-token' : '';
}
