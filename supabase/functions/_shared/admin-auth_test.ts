import { assertEquals } from '@std/assert';

import { isVerifiedSession, tokenAal } from './admin-auth.ts';

const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (claims: unknown) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.sig`;

Deno.test('reads the aal claim', () => {
  assertEquals(tokenAal(jwt({ sub: 'x', aal: 'aal2' })), 'aal2');
  assertEquals(tokenAal(jwt({ sub: 'x', aal: 'aal1' })), 'aal1');
  assertEquals(isVerifiedSession(jwt({ aal: 'aal2' })), true);
  assertEquals(isVerifiedSession(jwt({ aal: 'aal1' })), false);
});

Deno.test('anything malformed is not verified', () => {
  assertEquals(tokenAal(''), null);
  assertEquals(tokenAal('not-a-jwt'), null);
  assertEquals(tokenAal('a.%%%.c'), null);
  assertEquals(tokenAal(jwt({ sub: 'x' })), null);
  assertEquals(isVerifiedSession(jwt('aal2')), false);
});
