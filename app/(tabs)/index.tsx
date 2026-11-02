import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

const SECTIONS = [
  { title: 'Featured Games', description: 'Curated and trending titles from the IGDB cache.' },
  { title: 'Community Activity', description: 'Latest published reviews across the community.' },
  { title: 'Friend Updates', description: "Friends' Now Playing changes, new reviews, and favorites." },
  { title: 'Trending Lists', description: 'Most-reviewed and highest-rated games this week.' },
] as const;

export default function HomeScreen() {
  return <ScreenPlaceholder title="Home" subtitle="Community activity & friend feed" sections={SECTIONS} />;
}
