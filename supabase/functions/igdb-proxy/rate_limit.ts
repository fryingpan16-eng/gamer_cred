/** Postgres foreign-key violation: the counter row's account (auth.users) is gone. */
const FOREIGN_KEY_VIOLATION = '23503';

export type RateLimitVerdict = {
  /** Within the limit, or the counter hiccuped (callers decide whether to fail open). */
  allowed: boolean;
  /** The counter itself failed. */
  failed: boolean;
  /**
   * The account no longer exists (deleted or removed while its token is still unexpired).
   * Never fail open for this: answer 401.
   */
  accountGone: boolean;
};

/** Reads a take_rate_limit RPC answer. */
export function rateLimitVerdict(allowed: unknown, error: { code?: string } | null): RateLimitVerdict {
  const accountGone = error?.code === FOREIGN_KEY_VIOLATION;
  return { allowed: !accountGone && allowed !== false, failed: !!error, accountGone };
}
