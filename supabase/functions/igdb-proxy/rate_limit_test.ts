import { assertEquals } from '@std/assert';

import { rateLimitVerdict } from './rate_limit.ts';

Deno.test('within the limit', () => {
  assertEquals(rateLimitVerdict(true, null), { allowed: true, failed: false, accountGone: false });
});

Deno.test('over the limit', () => {
  assertEquals(rateLimitVerdict(false, null), { allowed: false, failed: false, accountGone: false });
});

Deno.test('a counter hiccup is reported as failed but still allowed (callers choose)', () => {
  assertEquals(rateLimitVerdict(null, { code: '57014' }), { allowed: true, failed: true, accountGone: false });
});

Deno.test('a deleted account (foreign-key violation) is never allowed', () => {
  assertEquals(rateLimitVerdict(null, { code: '23503' }), { allowed: false, failed: true, accountGone: true });
});
