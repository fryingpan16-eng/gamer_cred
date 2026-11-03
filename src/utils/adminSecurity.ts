import { z } from 'zod';

/** A 6-digit authenticator code; spaces are ignored. */
export const authCodeSchema = z
  .string()
  .transform((s) => s.replace(/\s/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'));

/** The setup key in groups of 4 so it's easy to type into an authenticator app. */
export function formatSetupKey(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}

export type AdminActivityEntry = {
  id: number;
  createdAt: string;
  adminName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown>;
};

const TARGET_NOUN: Record<string, string> = { review: 'review', list: 'list', rating: 'rating', user: 'player' };

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);

/** One readable line per logged admin action. */
export function describeAdminAction(entry: AdminActivityEntry): string {
  const title = str(entry.details.title);
  const named = title ? `list “${title}”` : 'a list';
  const noun = TARGET_NOUN[entry.targetType ?? ''] ?? 'item';
  const reports = num(entry.details.reports);
  const reportsText = reports === null ? '' : ` (${reports} report${reports === 1 ? '' : 's'})`;
  switch (entry.action) {
    case 'list.feature':
      return `Featured ${named} on Home${num(entry.details.rank) !== null ? ` at #${num(entry.details.rank)}` : ''}`;
    case 'list.unfeature':
      return `Unfeatured ${named}`;
    case 'list.smart_rule':
      return `Set the smart-list rule on ${named}`;
    case 'reports.dismiss':
      return `Dismissed reports on a ${noun}${reportsText}`;
    case 'reports.remove':
      return `Removed a reported ${noun}${reportsText}`;
    case 'avatar.approve':
      return 'Approved a held profile picture';
    case 'avatar.reject':
      return 'Rejected a held profile picture';
    case 'user.remove':
      return 'Removed a player’s account';
    default:
      return entry.action;
  }
}
