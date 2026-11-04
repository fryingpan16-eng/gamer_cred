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
  assertEquals(parseRequest({ action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' }), { action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' });
  assertEquals(parseRequest({ action: 'admin_decide', user_id: OTHER, approve: true }), null); // which picture?
  assertEquals(parseRequest({ action: 'admin_decide', user_id: 'nope', approve: true }), null);
  assertEquals(parseRequest('x'), null);
});

function fakes(over: Partial<AvatarDeps> = {}) {
  const log: string[] = [];
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); // JPEG header
  const deps: AvatarDeps = {
    callerId: ME,
    isAdmin: async (id) => id === ME,
    takeRateLimit: async () => true,
    readPending: async () => img,
    removePending: async (id) => void log.push(`removePending:${id}`),
    classify: async () => clean,
    publish: async (id) => (log.push(`publish:${id}`), { id }),
    hold: async (id, _i, reason) => void log.push(`hold:${id}:${reason}`),
    readHeld: async () => img,
    heldVersion: async () => 'v1',
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
  await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' }, deps);
  assertEquals(log, [`publish:${OTHER}`, `clearHeld:${OTHER}`, `log:${ME}:avatar.approve:${OTHER}`]);
  ({ deps, log } = fakes());
  await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: false, held_at: 'v1' }, deps);
  assertEquals(log, [`clearHeld:${OTHER}`, `log:${ME}:avatar.reject:${OTHER}`]);
  assertEquals((await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' }, fakes({ readHeld: async () => null }).deps)).status, 404);
});

Deno.test('admin_decide never approves a picture the admin was not shown', async () => {
  // A newer picture replaced the one listed.
  let { deps, log } = fakes({ heldVersion: async () => 'v2' });
  let res = await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' }, deps);
  assertEquals(res.status, 409);
  assertEquals(log, []);
  // It changed while the image was being read.
  let calls = 0;
  ({ deps, log } = fakes({ heldVersion: async () => (++calls === 1 ? 'v1' : 'v2') }));
  res = await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' }, deps);
  assertEquals(res.status, 409);
  assertEquals(log, []);
  // Nothing held any more.
  ({ deps } = fakes({ heldVersion: async () => null }));
  assertEquals((await handleAvatar({ action: 'admin_decide', user_id: OTHER, approve: true, held_at: 'v1' }, deps)).status, 404);
});

Deno.test('submit: only JPEGs are checked (animated GIF/PNG/WebP frames would skip the check)', async () => {
  for (const header of [
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], // PNG
    [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], // RIFF....WEBP
  ]) {
    let classified = false;
    const { deps, log } = fakes({
      readPending: async () => new Uint8Array(header),
      classify: async () => ((classified = true), clean),
    });
    const res = await handleAvatar({ action: 'submit' }, deps);
    assertEquals(res.status, 400);
    assertEquals(classified, false);
    assertEquals(log, [`removePending:${ME}`]);
  }
});

Deno.test('submit: rate limited before any download or paid check', async () => {
  let touched = false;
  const { deps } = fakes({
    takeRateLimit: async () => false,
    readPending: async () => ((touched = true), null),
    classify: async () => ((touched = true), clean),
  });
  const res = await handleAvatar({ action: 'submit' }, deps);
  assertEquals(res.status, 429);
  assertEquals(touched, false);
});
