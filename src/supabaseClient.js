// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Prefer env vars; keep your current values as fallbacks so the app keeps working.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://minftvflekxdoiubeujy.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbmZ0dmZsZWt4ZG9pdWJldWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MTc4NjgsImV4cCI6MjA2NjA5Mzg2OH0.Aj0-ts6WzffJRrXDkTMDKjQT4t6pW_-jSUft4md0KJM';

// Create exactly one client (prevents "Multiple GoTrueClient instances" in HMR)
export const supabase =
  globalThis.__supabase__ ??
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Optional: namespace the storage key to avoid clashes if you ever spin up a second client
      // storageKey: 'vook-auth',
    },
  });

// Cache across hot reloads
if (typeof window !== 'undefined') {
  globalThis.__supabase__ = supabase;
}
