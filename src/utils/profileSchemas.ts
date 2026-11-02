import { z } from 'zod';

import { usernameSchema } from './authSchemas';

export const profileSettingsSchema = z.object({
  username: usernameSchema,
  avatarUrl: z
    .string()
    .trim()
    .max(500, 'URL is too long')
    .refine((v) => v === '' || /^https:\/\/\S+$/i.test(v), 'Use an https:// image URL')
    .transform((v) => (v === '' ? null : v)),
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

const specField = z.string().trim().max(120, 'Keep it under 120 characters');

export const pcSpecsSchema = z.object({
  os: specField,
  cpu: specField,
  gpu: specField,
  ram: specField,
  storage: specField,
});

export type PcSpecs = z.output<typeof pcSpecsSchema>;

export const EMPTY_PC_SPECS: PcSpecs = { os: '', cpu: '', gpu: '', ram: '', storage: '' };

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
