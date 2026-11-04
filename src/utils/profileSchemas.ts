import { z } from 'zod';

import { containsObjectionable, OBJECTIONABLE_MESSAGE } from './contentFilter';

import { displayNameSchema } from './authSchemas';

/**
 * Settings → Account: the display name (the permanent name never changes). Profile
 * pictures are uploaded from the device (src/services/avatar.ts), not typed as URLs.
 */
export const profileSettingsSchema = z.object({
  displayName: displayNameSchema,
});

export type ProfileSettingsInput = z.input<typeof profileSettingsSchema>;
export type ProfileSettingsValues = z.output<typeof profileSettingsSchema>;

/** Classic "System Information" sheet. Stored as JSON in user_platforms.pc_specs (text). */
export const PC_SPEC_FIELDS = [
  { key: 'os', label: 'OS', placeholder: 'Windows 11 Pro' },
  { key: 'cpu', label: 'Processor', placeholder: 'AMD Ryzen 7 7800X3D' },
  { key: 'gpu', label: 'Video Card', placeholder: 'NVIDIA GeForce RTX 4070' },
  { key: 'ram', label: 'Memory', placeholder: '32 GB DDR5' },
  { key: 'storage', label: 'Storage', placeholder: '2 TB NVMe SSD' },
] as const;

export type PcSpecKey = (typeof PC_SPEC_FIELDS)[number]['key'];

const specField = z
  .string()
  .trim()
  .max(120, 'Keep it under 120 characters')
  .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE);

export const pcSpecsSchema = z.object({
  os: specField,
  cpu: specField,
  gpu: specField,
  ram: specField,
  storage: specField,
});

export type PcSpecs = z.output<typeof pcSpecsSchema>;

export const EMPTY_PC_SPECS: PcSpecs = { os: '', cpu: '', gpu: '', ram: '', storage: '' };

export const MAX_PLATFORM_DEVICES = 8;
export const DEVICE_NAME_MAX = 40;

/**
 * Device list for a roster entry (e.g. PC Handhelds). Names are trimmed,
 * whitespace-collapsed and de-duplicated case-insensitively (first spelling wins).
 * Limits mirror the DB checks in migration 000008.
 */
export const platformDevicesSchema = z
  .array(
    z
      .string()
      .transform((v) => v.trim().replace(/\s+/g, ' '))
      .pipe(z.string().min(1, 'Device name can’t be empty').max(DEVICE_NAME_MAX, `Keep names under ${DEVICE_NAME_MAX} characters`))
      .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE),
  )
  .transform((names) => {
    const seen = new Set<string>();
    return names.filter((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })
  .pipe(z.array(z.string()).max(MAX_PLATFORM_DEVICES, `List up to ${MAX_PLATFORM_DEVICES} devices`));

/** Lenient read: JSON from this app, or legacy free text (kept in `os`-less "notes" form). */
export function parsePcSpecs(raw: string | null): PcSpecs | null {
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = pcSpecsSchema.partial().safeParse(JSON.parse(raw));
    if (parsed.success) return { ...EMPTY_PC_SPECS, ...parsed.data };
  } catch {
    // not JSON — fall through
  }
  return { ...EMPTY_PC_SPECS, cpu: raw.slice(0, 120) };
}

/** Serialize, or null when every field is empty. */
export function serializePcSpecs(specs: PcSpecs): string | null {
  const filled = Object.entries(specs).filter(([, v]) => v.length > 0);
  return filled.length === 0 ? null : JSON.stringify(Object.fromEntries(filled));
}
