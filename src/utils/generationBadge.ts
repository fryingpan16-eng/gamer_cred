/**
 * Text for the game page's generation badge (migration 000051). Pure, so it is
 * unit-tested; GenerationBadge draws it.
 */
import { generationGroup, generationListTitle, generationTitle, isConsoleGeneration } from '@/constants/generations';
import type { GenerationBadgeData } from '@/services/games';

export type GenerationBadgeView = {
  /** "Gen 6" / "PC". */
  label: string;
  /** Release year under PC / Arcade / Mobile; null for consoles. */
  subLabel: string | null;
  /** "#12" on the corner when the game is in its Top 250. */
  rankText: string | null;
  /** The long-press panel: title, then one line per fact. */
  title: string;
  lines: string[];
  accessibilityLabel: string;
};

/** "Gen 1" / "a PC" style name inside a sentence. */
function inSentence(key: string): string {
  const group = generationGroup(key);
  if (!group) return key;
  return isConsoleGeneration(key) ? `a ${group.short}` : `${/^[aeiou]/i.test(group.short) ? 'an' : 'a'} ${group.short}`;
}

function andList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function generationBadgeView(data: GenerationBadgeData): GenerationBadgeView | null {
  const group = generationGroup(data.generation);
  if (!group) return null;
  const isConsole = isConsoleGeneration(group.key);
  const year = data.releaseYear === null ? null : String(data.releaseYear);
  const listName = generationListTitle(group);

  const lines: string[] = [];
  if (year) lines.push(`First released in ${year}.`);
  if (data.remakeOf) lines.push(`Remake of ${inSentence(data.remakeOf)} game.`);
  const remasters = data.remasteredFor.map((k) => generationGroup(k)?.short).filter((s): s is NonNullable<typeof s> => !!s);
  if (remasters.length > 0) lines.push(`Remastered for ${andList(remasters)}.`);
  lines.push(data.rank !== null ? `#${data.rank} in ${listName}.` : `Not in the ${listName} yet.`);

  const title = generationTitle(group);
  return {
    label: group.short,
    subLabel: isConsole ? null : year,
    rankText: data.rank !== null ? `#${data.rank}` : null,
    title,
    lines,
    accessibilityLabel: [title, !isConsole && year ? year : null, data.rank !== null ? `number ${data.rank} in the ${listName}` : null]
      .filter(Boolean)
      .join(', '),
  };
}
