import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { FunctionsHttpError } from '@supabase/supabase-js';

import type { ApiEnvelope } from '@/types/api';
import type { Profile } from '@/types/database.types';
import { base64ToBytes } from '@/utils/base64';

import { supabase } from './supabase';

/** Public bucket the `avatar` function publishes to (users can only delete their own file). */
const AVATAR_BUCKET = 'avatars';
/** Private screening bucket (migration 000022): users may only write <uid>/pending.jpg. */
const AVATAR_UPLOAD_BUCKET = 'avatar-uploads';
const pendingPath = (userId: string) => `${userId}/pending.jpg`;
const AVATAR_SIZE = 512;
const avatarPath = (userId: string) => `${userId}/avatar.jpg`;

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

export type PreparedAvatar = { base64: string; previewUri: string };

/**
 * Opens the photo library / file browser, then crops to a centred square and
 * resizes to 512×512 JPEG (a phone photo of several MB becomes ~50 KB).
 * Returns null when the user cancels. No permission prompt is needed for the
 * library picker; on web it must run from a button press.
 */
export async function pickAvatarImage(): Promise<PreparedAvatar | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true, // native crop UI (square); web has none, so we crop below
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  try {
    const side = Math.min(asset.width, asset.height);
    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width !== asset.height && side > 0) {
      context.crop({
        originX: Math.floor((asset.width - side) / 2),
        originY: Math.floor((asset.height - side) / 2),
        width: side,
        height: side,
      });
    }
    context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
    if (!saved.base64) throw new Error('no image data');
    return { base64: saved.base64, previewUri: saved.uri };
  } catch {
    throw new AvatarError('That image couldn’t be processed. Try a different photo.');
  }
}

/** What happened to an uploaded picture (decided server-side by the `avatar` function). */
export type AvatarUploadResult =
  | { status: 'approved'; profile: Profile }
  /** Borderline or the check was unavailable: an admin decides. The old picture stays meanwhile. */
  | { status: 'held' };

export type HeldPicture = {
  userId: string;
  username: string | null;
  reason: string;
  scores: { adult: string; racy: string; violence: string } | null;
  createdAt: string;
  /** Short-lived signed URL (private bucket). */
  imageUrl: string | null;
};

type AvatarFunctionRequest =
  | { action: 'submit' }
  | { action: 'admin_list' }
  | { action: 'admin_decide'; user_id: string; approve: boolean; held_at: string };

async function invokeAvatar<T>(body: AvatarFunctionRequest): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ApiEnvelope<T>>('avatar', { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const envelope = (await (error.context as Response).json().catch(() => null)) as { error?: string } | null;
      throw new AvatarError(envelope?.error ?? 'The picture check failed. Try again.');
    }
    throw new AvatarError('Couldn’t reach GamerCred. Check your connection and try again.');
  }
  if (!data?.success) throw new AvatarError(data?.error ?? 'The picture check failed. Try again.');
  return data.data;
}

export const REJECTED_AVATAR_MESSAGE =
  'That picture can’t be used. Profile pictures must follow the Community Guidelines (no nudity, sexual or graphic content).';

/**
 * Uploads to the private screening bucket, then asks the `avatar` function to check it.
 * Clean pictures go live at once; rejected ones throw; borderline ones wait for an admin.
 */
export async function uploadAvatar(userId: string, avatar: PreparedAvatar): Promise<AvatarUploadResult> {
  const bytes = base64ToBytes(avatar.base64);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_UPLOAD_BUCKET)
    // ArrayBuffer body, as in Supabase's React Native upload guidance.
    .upload(pendingPath(userId), bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw new AvatarError(uploadError.message || 'Upload failed. Try again.');

  const result = await invokeAvatar<{ status: 'approved'; profile: Profile } | { status: 'rejected' } | { status: 'held' }>({ action: 'submit' });
  if (result.status === 'rejected') throw new AvatarError(REJECTED_AVATAR_MESSAGE);
  return result;
}

/** Admin: pictures waiting for a decision (oldest first). */
export async function fetchHeldAvatars(): Promise<HeldPicture[]> {
  return (await invokeAvatar<{ pictures: HeldPicture[] }>({ action: 'admin_list' })).pictures;
}

/** Admin: publish (approve) or discard a held picture. */
/** `heldAt` = the picture's createdAt as listed, so a newer upload is never approved unseen. */
export async function decideHeldAvatar(userId: string, approve: boolean, heldAt: string): Promise<void> {
  await invokeAvatar({ action: 'admin_decide', user_id: userId, approve, held_at: heldAt });
}

/** Clears the profile picture (and deletes the uploaded file, if any). */
export async function removeAvatar(userId: string): Promise<Profile> {
  // Ignore storage errors: the picture may be an external (e.g. Google) URL with no file.
  await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw new AvatarError(error.message || 'Could not remove your profile picture.');
  return profile;
}
