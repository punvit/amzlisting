// Browser-only Supabase client. Safe to import from Client Components.
// (Kept separate from lib/supabase.ts so that server-only `next/headers`
// never gets pulled into the client bundle.)

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
