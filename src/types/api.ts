/** Standard Edge Function response envelope (see CLAUDE.md). */
export type ApiEnvelope<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: string };
