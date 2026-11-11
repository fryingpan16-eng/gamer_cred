/**
 * How long to beat (IGDB `game_time_to_beats`): average play times from
 * player submissions, in seconds. Best-effort on the game page.
 */
import type { GameTimeToBeat } from '../_shared/igdb-contract.ts';

export type RawTimeToBeat = { hastily?: number | null; normally?: number | null; completely?: number | null; count?: number | null };

export const TIME_TO_BEAT_FIELDS = 'fields hastily,normally,completely,count;';

const seconds = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null);

/** IGDB row → our shape; null when there are no usable times. */
export function mapTimeToBeat(raw: RawTimeToBeat | undefined): GameTimeToBeat | null {
  if (!raw) return null;
  const t: GameTimeToBeat = {
    main: seconds(raw.hastily),
    extras: seconds(raw.normally),
    complete: seconds(raw.completely),
    count: typeof raw.count === 'number' && raw.count > 0 ? Math.round(raw.count) : 0,
  };
  return t.main === null && t.extras === null && t.complete === null ? null : t;
}
