/**
 * Profile picture screening (store requirement: filter objectionable user content).
 *
 * The app uploads to the private `avatar-uploads/<uid>/pending.jpg`, then calls
 * `submit`. The picture is scored with Google Cloud Vision SafeSearch and either
 * published to the public `avatars` bucket, rejected, or held for an admin.
 * If the check can't run (no key, outage) the picture is HELD, never published.
 * Kept separate from index.ts so it is unit-tested with fakes.
 */

export type Likelihood = 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';

/** The parts of Vision's safeSearchAnnotation we act on. */
export type SafeSearch = { adult: Likelihood; racy: Likelihood; violence: Likelihood };

export type Verdict =
  | { decision: 'approve' }
  | { decision: 'reject'; reason: 'adult' | 'racy' | 'violence' }
  | { decision: 'hold'; reason: 'check_unavailable' | 'possible_adult' | 'possibly_racy' | 'possible_violence' };

const atLeast = (value: Likelihood, floor: Likelihood) => {
  const order: Likelihood[] = ['VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
  return order.indexOf(value) >= order.indexOf(floor);
};

/**
 * Nudity is rejected outright when likely; anything borderline goes to a human.
 * Racy (e.g. swimwear) and violence are only rejected at the very top of the scale.
 */
export function verdictFor(scores: SafeSearch | null): Verdict {
  if (!scores) return { decision: 'hold', reason: 'check_unavailable' };
  if (atLeast(scores.adult, 'LIKELY')) return { decision: 'reject', reason: 'adult' };
  if (scores.violence === 'VERY_LIKELY') return { decision: 'reject', reason: 'violence' };
  if (scores.racy === 'VERY_LIKELY') return { decision: 'reject', reason: 'racy' };
  if (scores.adult === 'POSSIBLE' || scores.adult === 'UNKNOWN') return { decision: 'hold', reason: 'possible_adult' };
  if (scores.racy === 'LIKELY') return { decision: 'hold', reason: 'possibly_racy' };
  if (scores.violence === 'LIKELY') return { decision: 'hold', reason: 'possible_violence' };
  return { decision: 'approve' };
}

const LIKELIHOODS = new Set<string>(['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY']);

/** Reads Vision's `images:annotate` response; null when it has no usable annotation. */
export function parseVisionResponse(json: unknown): SafeSearch | null {
  const annotation = (json as { responses?: { safeSearchAnnotation?: Record<string, unknown> }[] })?.responses?.[0]?.safeSearchAnnotation;
  if (!annotation) return null;
  const pick = (key: string): Likelihood => (LIKELIHOODS.has(String(annotation[key])) ? (annotation[key] as Likelihood) : 'UNKNOWN');
  return { adult: pick('adult'), racy: pick('racy'), violence: pick('violence') };
}

export type HeldPicture = { userId: string; username: string | null; reason: string; scores: SafeSearch | null; createdAt: string; imageUrl: string | null };

export type AvatarRequest =
  | { action: 'submit' }
  | { action: 'admin_list' }
  | { action: 'admin_decide'; user_id: string; approve: boolean };

export type AvatarDeps = {
  callerId: string | null;
  isAdmin: (userId: string) => Promise<boolean>;
  readPending: (userId: string) => Promise<Uint8Array | null>;
  removePending: (userId: string) => Promise<void>;
  /** Vision SafeSearch, or null when the check can't run. */
  classify: (image: Uint8Array) => Promise<SafeSearch | null>;
  /** Writes avatars/<uid>/avatar.jpg and points the profile at it; returns the updated profile row. */
  publish: (userId: string, image: Uint8Array) => Promise<unknown>;
  hold: (userId: string, image: Uint8Array, reason: string, scores: SafeSearch | null) => Promise<void>;
  readHeld: (userId: string) => Promise<Uint8Array | null>;
  clearHeld: (userId: string) => Promise<void>;
  listHeld: () => Promise<HeldPicture[]>;
};

export type AvatarResult = { status: number; body: { success: true; data: unknown } | { success: false; error: string } };

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseRequest(body: unknown): AvatarRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.action === 'submit') return { action: 'submit' };
  if (b.action === 'admin_list') return { action: 'admin_list' };
  if (b.action === 'admin_decide' && typeof b.user_id === 'string' && UUID.test(b.user_id) && typeof b.approve === 'boolean') {
    return { action: 'admin_decide', user_id: b.user_id.toLowerCase(), approve: b.approve };
  }
  return null;
}

const ok = (data: unknown): AvatarResult => ({ status: 200, body: { success: true, data } });
const fail = (status: number, error: string): AvatarResult => ({ status, body: { success: false, error } });

export async function handleAvatar(req: AvatarRequest | null, deps: AvatarDeps): Promise<AvatarResult> {
  if (!deps.callerId) return fail(401, 'You must be signed in.');
  if (!req) return fail(400, 'Unknown request.');
  const me = deps.callerId;

  if (req.action === 'submit') {
    const image = await deps.readPending(me);
    if (!image) return fail(400, 'Upload the picture first.');
    if (image.byteLength > MAX_AVATAR_BYTES) {
      await deps.removePending(me);
      return fail(400, 'That picture is too large.');
    }
    const scores = await deps.classify(image);
    const verdict = verdictFor(scores);
    if (verdict.decision === 'approve') {
      const profile = await deps.publish(me, image);
      await deps.removePending(me);
      await deps.clearHeld(me); // a newer clean picture replaces one waiting for review
      return ok({ status: 'approved', profile });
    }
    if (verdict.decision === 'reject') {
      await deps.removePending(me);
      return ok({ status: 'rejected', reason: verdict.reason });
    }
    await deps.hold(me, image, verdict.reason, scores);
    await deps.removePending(me);
    return ok({ status: 'held', reason: verdict.reason });
  }

  if (!(await deps.isAdmin(me))) return fail(403, 'Only app admins can review pictures.');

  if (req.action === 'admin_list') return ok({ pictures: await deps.listHeld() });

  // admin_decide
  const image = await deps.readHeld(req.user_id);
  if (!image) return fail(404, 'That picture is no longer waiting for review.');
  if (req.approve) await deps.publish(req.user_id, image);
  await deps.clearHeld(req.user_id);
  return ok({ status: req.approve ? 'approved' : 'rejected' });
}
