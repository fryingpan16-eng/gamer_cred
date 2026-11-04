/** Cloudflare Turnstile (bot check before every sign-in / sign-up / guest session). */
export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;

/** Off when no site key is configured (local development): forms then skip the check. */
export const HUMAN_CHECK_ENABLED = TURNSTILE_SITE_KEY !== null;

/** The phone widget runs as this origin, which must be one of the Turnstile widget's hostnames. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL?.trim() || 'https://localhost';

export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
