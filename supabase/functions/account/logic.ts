/**
 * Account deletion + admin user removal (store requirement: in-app account
 * deletion — Apple 5.1.1(v), Google Play User Data policy).
 *
 * Deleting the auth user cascades every table (profiles → reviews, ratings,
 * lists, friendships, Now Playing, favourites, platforms, blocks, terms…).
 * Avatar files live in Storage and are removed first. Kept separate from
 * index.ts so it is unit-tested with fakes.
 */
export type AccountRequest = { action: 'delete_self' } | { action: 'admin_delete_user'; user_id: string };

export type AccountDeps = {
  /** The signed-in caller (from the request's JWT), or null. */
  callerId: string | null;
  /** In app_admins AND this request's session is two-step verified (migration 000025). */
  isAdmin: (userId: string) => Promise<boolean>;
  /** Append to the admin activity log. */
  logAdmin: (adminId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) => Promise<void>;
  /** Paths of every file in avatars/<userId>/. */
  listAvatarFiles: (userId: string) => Promise<string[]>;
  removeAvatarFiles: (paths: string[]) => Promise<void>;
  /** Mark open reports about the user as actioned (moderation history). */
  closeReportsAbout: (userId: string, adminId: string) => Promise<void>;
  deleteAuthUser: (userId: string) => Promise<void>;
};

export type AccountResult = { status: number; body: { success: true; data: { deleted: string } } | { success: false; error: string } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRequest(body: unknown): AccountRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.action === 'delete_self') return { action: 'delete_self' };
  if (b.action === 'admin_delete_user' && typeof b.user_id === 'string' && UUID.test(b.user_id)) {
    return { action: 'admin_delete_user', user_id: b.user_id.toLowerCase() };
  }
  return null;
}

async function deleteEverything(userId: string, deps: AccountDeps): Promise<void> {
  const files = await deps.listAvatarFiles(userId);
  if (files.length > 0) await deps.removeAvatarFiles(files);
  await deps.deleteAuthUser(userId);
}

export async function handleAccount(req: AccountRequest | null, deps: AccountDeps): Promise<AccountResult> {
  if (!deps.callerId) return { status: 401, body: { success: false, error: 'You must be signed in.' } };
  if (!req) return { status: 400, body: { success: false, error: 'Unknown request.' } };

  if (req.action === 'delete_self') {
    await deleteEverything(deps.callerId, deps);
    return { status: 200, body: { success: true, data: { deleted: deps.callerId } } };
  }

  // admin_delete_user
  if (!(await deps.isAdmin(deps.callerId))) {
    return { status: 403, body: { success: false, error: 'Only app admins with two-step sign-in verified can remove users.' } };
  }
  if (req.user_id === deps.callerId) {
    return { status: 400, body: { success: false, error: 'Use “Delete account” in Settings to delete your own account.' } };
  }
  await deps.closeReportsAbout(req.user_id, deps.callerId);
  await deleteEverything(req.user_id, deps);
  await deps.logAdmin(deps.callerId, 'user.remove', 'user', req.user_id);
  return { status: 200, body: { success: true, data: { deleted: req.user_id } } };
}
