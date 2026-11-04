declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_SUPABASE_URL: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    /** Cloudflare Turnstile site key (public). Unset = no human check (local dev). */
    readonly EXPO_PUBLIC_TURNSTILE_SITE_KEY?: string;
    /** The web app's address, e.g. https://gamercred.example.com — the phone human check runs as this site. */
    readonly EXPO_PUBLIC_SITE_URL?: string;
  }
}
