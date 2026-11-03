import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { Profile } from '@/types/database.types';
import { base64ToBytes } from '@/utils/base64';

import { supabase } from './supabase';

/** Storage bucket + per-user path (policies in migration 000011 restrict writes to `<uid>/`). */
const AVATAR_BUCKET = 'avatars';
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

/** Uploads (replacing any previous picture) and points the profile at it. */
export async function uploadAvatar(userId: string, avatar: PreparedAvatar): Promise<Profile> {
  const bytes = base64ToBytes(avatar.base64);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    // ArrayBuffer body, as in Supabase's React Native upload guidance.
    .upload(avatarPath(userId), bytes.buffer as ArrayBuffer, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (uploadError) throw new AvatarError(uploadError.message || 'Upload failed. Try again.');

  // Same path on every upload, so bust caches with a version parameter.
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath(userId));
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { data: profile, error } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw new AvatarError(error.message || 'Could not save your profile picture.');
  return profile;
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
