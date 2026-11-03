// deno-lint-ignore-file require-await -- fakes mirror the async deps
import { assertEquals } from '@std/assert';

import { handleAvatar, parseRequest, parseVisionResponse, verdictFor, type AvatarDeps, type SafeSearch } from './logic.ts';

const ME = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
const clean: SafeSearch = { adult: 'VERY_UNLIKELY', racy: 'UNLIKELY', violence: 'VERY_UNLIKELY' };

Deno.test('verdict: nudity rejected, borderline held, clean approved, no check → held', () => {
  assertEquals(verdictFor(clean), { decision: 'approve' });
  assertEquals(verdictFor({ ...clean, adult: 'LIKELY' }), { decision: 'reject', reason: 'adult' });
  assertEquals(verdictFor({ ...clean, adult: 'VERY_LIKELY' }), { decision: 'reject', reason: 'adult' });
  assertEquals(verdictFor({ ...clean, adult: 'POSSIBLE' }), { decision: 'hold', reason: 'possible_adult' });
  assertEquals(verdictFor({ ...clean, adult: 'UNKNOWN' }), { decision: 'hold', reason: 'possible_adult' });
  assertEquals(verdictFor({ ...clean, racy: 'LIKELY' }), { decision: 'hold', reason: 'possibly_racy' });
  assertEquals(verdictFor({ ...clean, racy: 'VERY_LIKELY' }), { decision: 'reject', reason: 'racy' });
  assertEquals(verdictFor({ ...clean, violence: 'LIKELY' }), { decision: 'hold', reason: 'possible_violence' });
  assertEquals(verdictFor({ ...clean, violence: 'VERY_LIKELY' }), { decision: 'reject', reason: 'violence' });
  assertEquals(verdictFor(null), { decision: 'hold', reason: 'check_unavailable' });
});

Deno.test('parseVisionResponse reads the annotation; errors and junk → null / UNKNOWN', () => {
  assertEquals(parseVisionResponse({ responses: [{ safeSearchAnnotation: { adult: 'LIKELY', racy: 'POSSIBLE', violence: 'UNLIKELY', medical: 'x' } }] }), {
    adult: 'LIKELY', racy: 'POSSIBLE', violence: 'UNLIKELY',
  });
  assertEquals(parseVisionResponse({ responses: [{ error: { message: 'bad image' } }] }), null);
  assertEquals(parseVisionResponse(null), null);
  assertEquals(parseVisionResponse({ responses: [{ safeSearchAnnotation: { adult: 'weird' } }] })?.adult, 'UNKNOWN');
});

Deno.test('parseRequest', () => {
  assertEquals(parseRequest({ action: 'submit' }), { action: 'submit' });
  assertEquals(parseRequest({ action: 'admin_decide', user_id: OTHER, approve: true }), { action: 'admin_decide', user_id: OTHER, approve: true });
  assertEquals(parseRequest({ action: 'admin_decide', user_id: 'nope', approve: true }), null);
  assertEquals(parseRequest('x'), null);
});

function fakes(over: Partial<AvatarDeps> = {}) {
  const log: string[] = [];
  const img = new Uint8Array([1, 2, 3]);
  const deps: AvatarDeps = {
    callerId: ME,
    isAdmin: async (id) => id === ME,
    readPending: async () => img,
    removePending: async (id) => void log.push(`removePending:${id}`),
    classify: async () => clean,
    publish: async (id) => (log.push(`publish:${id}`), { id }),
    hold: async (id, _i, reason) => void log.push(`hold:${id}:${reason}`),
    readHeld: async () => img,
    clearHeld: async (id) => void log.push(`clearHeld:${id}`),
    listHeld: async () => [],
    logAdmin: async (admin, action, _type, target) => void log.push(`log:${admin}:${action}:${target}`),
    ...over,
  };
  return { deps, log };
}

Deno.test('submit: clean → published; nudity → rejected and never published; outage → held', async () => {
  let { deps, log } = fakes();
  let res = await handleAvatar({ action: 'submit' }, deps);
  assertEquals(res.body, { success: true, data: { status: 'approved', profile: { id: ME } } });
  assertEquals(log, [`publish:${ME}`, `removePending:${ME}`, `clearHeld:${ME}`]);

  ({ deps, log } = fakes({ classify: async () => ({ ...clean, adult: 'VERY_LIKELY' }) }));
  res = await handleAvatar({ action: 'submit' }, deps);
  assertEquals(res.body, { success: true, data: { status: 'rejected', reason: 'adult' } });
  assertEquals(log, [`removePending:${ME}`]);

  ({ deps, log } = fakes({ classify: async () => null }));
  res = await handleAvatar({ action: 'submit' }, deps);
  assertEquals(res.body, { success: true, data: { status: 'held', reason: 'check_unavailable' } });
  assertEquals(log, [`hold:${ME}:check_unavailable`, `removePending:${ME}`]);
});

Deno.test('submit guards: signed out, nothing uploaded, too large', async () => {
  assertEquals((await handleAvatar({ action: 'submit' }, fakes({ callerId: null }).deps)).status, 401);
  assertEquals((await handleAvatar({ action: 'submit' }, fakes({ readPending: async () => null }).deps)).status, 400);
  const big = fakes({ readPending: async () => new Uint8Array(3 * 1024 * 1024) });
  assertEquals((await handleAvatar({ action: 'submit' }, big.deps)).status, 400);
  assertEquals(big.log, [`removePending:${ME}`]);
});

Deno.test('admin review: only admins; approve publishes the held picture, reject just clears it', async () => {
  assertEquals((await handleAvatar({ action: 'admin_list' }, fakes({ callerId: OTHER }).deps)).status, 403);
  let { deps, log } = fakes();
  await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true }, deps);
  assertEquals(log, [`publish:${OTHER}`, `clearHeld:${OTHER}`, `log:${ME}:avatar.approve:${OTHER}`]);
  ({ deps, log } = fakes());
  await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: false }, deps);
  assertEquals(log, [`clearHeld:${OTHER}`, `log:${ME}:avatar.reject:${OTHER}`]);
  assertEquals((await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true }, fakes({ readHeld: async () => null }).deps)).status, 404);
});
