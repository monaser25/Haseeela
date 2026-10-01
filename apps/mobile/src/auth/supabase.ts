import { AppState, Platform } from 'react-native';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { chunkedSecureStore } from './secureStore';

let client: SupabaseClient | null = null;
let appStateListenerAdded = false;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: chunkedSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  if (!appStateListenerAdded && Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client?.auth.startAutoRefresh();
      } else {
        client?.auth.stopAutoRefresh();
      }
    });
    appStateListenerAdded = true;
  }

  return client;
}

export function setSupabaseClientForTesting(testClient: SupabaseClient | null) {
  client = testClient;
}

export const supabase = {
  get auth() {
    return getSupabaseClient().auth;
  },
};
