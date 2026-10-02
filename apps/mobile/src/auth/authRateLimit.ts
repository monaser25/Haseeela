export const AUTH_EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
export const AUTH_EMAIL_RATE_LIMIT_COOLDOWN_MS = 60 * 60 * 1000;

const cooldowns = new Map<string, number>();

export const isAuthEmailRateLimited = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('email rate limit') ||
    normalized.includes('rate limit exceeded') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('for security purposes')
  );
};

export const isEmailNotConfirmed = (message: string): boolean =>
  message.toLowerCase().includes('email not confirmed');

export const setAuthEmailCooldown = (
  email: string,
  durationMs = AUTH_EMAIL_RESEND_COOLDOWN_MS
) => {
  if (!email) return;
  cooldowns.set(email.toLowerCase(), Date.now() + durationMs);
};

export const getAuthEmailCooldownSeconds = (email: string): number => {
  if (!email) return 0;
  const expiresAt = cooldowns.get(email.toLowerCase()) || 0;
  if (!expiresAt || expiresAt <= Date.now()) {
    cooldowns.delete(email.toLowerCase());
    return 0;
  }
  return Math.ceil((expiresAt - Date.now()) / 1000);
};

export const formatAuthWaitTime = (seconds: number): string => {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} min`;
  return `${seconds}s`;
};

export const getAuthErrorMessage = (message: string): string => {
  if (isAuthEmailRateLimited(message)) {
    return 'Supabase email rate limit was exceeded. Wait before trying again, or configure custom SMTP in Supabase Auth for higher email limits.';
  }
  return message;
};
