export interface MobileEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
}

export function getEnv(): MobileEnv {
  const missing: string[] = [];

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!apiUrl) missing.push('EXPO_PUBLIC_API_URL');

  if (missing.length > 0) {
    throw new Error(
      `Missing required mobile environment variable(s): ${missing.join(', ')}. Please check your .env configuration.`
    );
  }

  return {
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    apiUrl: apiUrl!,
  };
}

export const env = {
  get supabaseUrl(): string {
    return getEnv().supabaseUrl;
  },
  get supabaseAnonKey(): string {
    return getEnv().supabaseAnonKey;
  },
  get apiUrl(): string {
    return getEnv().apiUrl;
  },
};
