import { assertEquals } from '@std/assert';

import { handleAccount, parseRequest, type AccountDeps } from './logic.ts';

const ME = '00000000-0000-0000-0000-00000000000a';
const BAD = '00000000-0000-0000-0000-00000000000b';

function fakes(callerId: string | null, admins: string[] = []) {
  const calls: string[] = [];
  const deps: AccountDeps = {
    callerId,
    isAdmin: (id) => Promise.resolve(admins.includes(id)),
    listAvatarFiles: (id) => Promise.resolve([`${id}/avatar.jpg`]),
    removeAvatarFiles: (paths) => {
      calls.push(`storage:${paths.join(',')}`);
      return Promise.resolve();
    },
    closeReportsAbout: (id, admin) => {
      calls.push(`reports:${id}:${admin}`);
      return Promise.resolve();
    },
    deleteAuthUser: (id) => {
      calls.push(`auth:${id}`);
      return Promise.resolve();
    },
    logAdmin: (admin, action, _type, target) => {
      calls.push(`log:${admin}:${action}:${target}`);
      return Promise.resolve();
    },
  };
  return { deps, calls };
}

Deno.test('delete_self deletes the auth user (which cascades all data), then the avatar files', async () => {
  const { deps, calls } = fakes(ME);
  const res = await handleAccount(parseRequest({ action: 'delete_self' }), deps);
  assertEquals(res, { status: 200, body: { success: true, data: { deleted: ME } } });
  assertEquals(calls, [`auth:${ME}`, `storage:${ME}/avatar.jpg`]);
});

Deno.test('signed out or malformed requests delete nothing', async () => {
  const a = fakes(null);
  assertEquals((await handleAccount({ action: 'delete_self' }, a.deps)).status, 401);
  const b = fakes(ME);
  assertEquals((await handleAccount(parseRequest({ action: 'drop_tables' }), b.deps)).status, 400);
  assertEquals((await handleAccount(parseRequest({ action: 'admin_delete_user', user_id: 'x' }), b.deps)).status, 400);
  assertEquals([...a.calls, ...b.calls], []);
});

Deno.test('only admins remove other users; reports close only after the account is gone', async () => {
  const notAdmin = fakes(ME);
  assertEquals((await handleAccount({ action: 'admin_delete_user', user_id: BAD }, notAdmin.deps)).status, 403);
  assertEquals(notAdmin.calls, []);

  const admin = fakes(ME, [ME]);
  const res = await handleAccount({ action: 'admin_delete_user', user_id: BAD }, admin.deps);
  assertEquals(res.status, 200);
  assertEquals(admin.calls, [`auth:${BAD}`, `storage:${BAD}/avatar.jpg`, `reports:${BAD}:${ME}`, `log:${ME}:user.remove:${BAD}`]);
  // an admin can't remove themselves through the moderation path
  assertEquals((await handleAccount({ action: 'admin_delete_user', user_id: ME }, fakes(ME, [ME]).deps)).status, 400);
});

Deno.test('a failed deletion changes nothing: files kept, reports still open', async () => {
  const admin = fakes(ME, [ME]);
  admin.deps.deleteAuthUser = () => Promise.reject(new Error('network'));
  let threw = false;
  try {
    await handleAccount({ action: 'admin_delete_user', user_id: BAD }, admin.deps);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
  assertEquals(admin.calls, []);
});

Deno.test('a failed picture cleanup does not fail the deletion', async () => {
  const self = fakes(ME);
  self.deps.removeAvatarFiles = () => Promise.reject(new Error('storage down'));
  assertEquals((await handleAccount({ action: 'delete_self' }, self.deps)).status, 200);
  assertEquals(self.calls, [`auth:${ME}`]);
});
