import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

const SECTIONS = [
  { title: 'Now Playing', description: 'Public view of your 4 active Now Playing slots.' },
  { title: 'Top 4 Favorites', description: 'Your all-time favorite games showcase.' },
  { title: 'Hardware & Platforms', description: 'Owned consoles/platforms, PC specs, and your Main platform badge.' },
] as const;

export default function ProfileScreen() {
  return <ScreenPlaceholder title="Profile" subtitle="Your public gamer card" sections={SECTIONS} />;
}
