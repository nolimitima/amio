import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kackbfwjspxbvkucytre.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthY2tiZndqc3B4YnZrdWN5dHJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2OTQxNTQsImV4cCI6MjA2OTI3MDE1NH0.L8N8MY1MLZskar3IfLHGqu9L1ZKnMe9Fp1FbFrAoVuQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
}); 