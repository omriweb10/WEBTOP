/** Build-time environment (Vite). Both values are public by design; see docs/supabase-setup.md. */
interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://xyz.supabase.co. Unset = local-only mode. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (publishable) key. Never put the service-role key here. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
