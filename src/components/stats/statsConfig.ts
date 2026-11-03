import type { ComponentType } from 'react';

import { GenresStat } from './GenresStat';
import { LoggedOverTimeStat } from './LoggedOverTimeStat';
import { PlatformsStat } from './PlatformsStat';
import { RatingDistributionStat } from './RatingDistributionStat';
import { NumericRatingsStat, RoundedRatingsStat, StarRatingsStat, TierRatingsStat } from './RatingScaleStat';
import { ReleaseEraStat } from './ReleaseEraStat';
import { StudiosStat } from './StudiosStat';
import { SummaryStat } from './SummaryStat';
import { VsCommunityStat } from './VsCommunityStat';

export type StatDefinition = {
  /** URL-safe id (also the `?stat=` deep link). */
  id: string;
  title: string;
  /** One line under the title in the main panel. */
  description: string;
  /** Mounted only while selected, so only this stat fetches its data. */
  component: ComponentType;
};

/**
 * The Stats menu, in display order. Adding a stat = adding one entry here
 * (see src/components/stats/README.md).
 */
export const STATS: readonly StatDefinition[] = [
  { id: 'summary', title: 'Gamer Profile', description: 'A quick read on your tastes, from all your stats.', component: SummaryStat },
  { id: 'ratings-numeric', title: 'Ratings: 1–100', description: 'How many games you gave each score, 100 down to 1.', component: NumericRatingsStat },
  { id: 'ratings-tier', title: 'Ratings: Tier', description: 'Your ratings as a tier list, S** down to F.', component: TierRatingsStat },
  { id: 'ratings-stars', title: 'Ratings: Stars', description: 'Your ratings on the 5-star scale.', component: StarRatingsStat },
  { id: 'ratings-rounded', title: 'Ratings: Rounded', description: 'Your ratings rounded to a score out of 10.', component: RoundedRatingsStat },
  { id: 'platforms', title: 'Platforms', description: 'Where you play, from the “Played on” platform of each review.', component: PlatformsStat },
  { id: 'studios', title: 'Studios', description: 'The developers whose games you play most.', component: StudiosStat },
  { id: 'genres', title: 'Genres', description: 'What you play, and how you rate each genre.', component: GenresStat },
  { id: 'distribution', title: 'Rating Habits', description: 'How often you give each score — harsh or generous?', component: RatingDistributionStat },
  { id: 'community', title: 'You vs Community', description: 'Your scores against IGDB’s community rating, and your hot takes.', component: VsCommunityStat },
  { id: 'era', title: 'Release Era', description: 'Which era of games you play.', component: ReleaseEraStat },
  { id: 'timeline', title: 'Logged Over Time', description: 'When you logged your games.', component: LoggedOverTimeStat },
];

export function findStat(id: string | undefined): StatDefinition {
  return STATS.find((s) => s.id === id) ?? STATS[0]!;
}
