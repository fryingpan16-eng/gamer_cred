/**
 * Support contact + Terms of Use / Community Guidelines shown in the app
 * (/terms) and accepted on sign-up. Both app stores require, for apps with
 * user-generated content: terms with zero tolerance for objectionable content
 * and abusive users, a way to report and block, and a published contact.
 *
 * This text is a starting point written for GamerCred — have it reviewed
 * before launch. Bump TERMS_VERSION whenever the meaning changes: everyone is
 * asked to accept the new version on their next visit.
 */
export const SUPPORT_EMAIL = 'jjlabber16@gmail.com';

export const TERMS_VERSION = '2026-11-10';

/** Effective date of the Privacy Policy (shown on /privacy). */
export const PRIVACY_VERSION = '2026-11-10';

/** How quickly reports are reviewed (Apple expects action within 24 hours). */
export const REPORT_RESPONSE_HOURS = 24;

export type LegalSection = { title: string; paragraphs: readonly string[] };

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: 'The short version',
    paragraphs: [
      'GamerCred is a community for rating, reviewing and listing video games. Be respectful. There is zero tolerance for objectionable content or abusive users: content that breaks these rules is removed, and accounts that post it can be removed without warning.',
    ],
  },
  {
    title: 'Community Guidelines',
    paragraphs: [
      'Don’t post anything that is hateful or harassing: no slurs, threats, bullying, or attacks on anyone for their race, ethnicity, religion, gender, sexuality, disability or similar.',
      'No sexual content, graphic violence, content that promotes self-harm, or anything illegal.',
      'No spam, scams, advertising, or impersonating another person.',
      'Mark or avoid major story spoilers in reviews where you can.',
      'Your username, profile picture, reviews, ratings, lists and other public activity must follow these rules too.',
    ],
  },
  {
    title: 'Reporting and blocking',
    paragraphs: [
      'You can report any review, list, rating or player with the Report option. Reports go to the GamerCred team, who review them within 24 hours and remove content or accounts that break these rules.',
      'You can block any player from their profile. Blocking removes any friendship between you, stops friend requests, and hides each of you (profile, reviews, ratings, lists and activity) from the other. You can unblock from Settings.',
      `You can also email ${SUPPORT_EMAIL} about anything on GamerCred.`,
    ],
  },
  {
    title: 'Your content',
    paragraphs: [
      'You keep ownership of what you post. By posting public content you allow GamerCred to display it in the app to other users.',
      'Ratings, published reviews, public lists and your profile are visible to other users. Drafts and private lists are only visible to you.',
      'Profile pictures are checked automatically (using Google Cloud Vision) before other players can see them. Pictures the check isn’t sure about are reviewed by the GamerCred team.',
    ],
  },
  {
    title: 'Your account',
    paragraphs: [
      'You must be old enough to use online services where you live (at least 13).',
      'Sign-in, sign-up and guest sessions may include an automatic “are you human?” check (Cloudflare Turnstile) to keep bots out.',
      'You can delete your account at any time in Settings → Delete Account. This permanently deletes your profile and everything you posted. If you can’t use the app, see the account deletion page or email us.',
      'We may suspend or remove accounts that break these terms.',
    ],
  },
  {
    title: 'Game information',
    paragraphs: [
      'Game details come from IGDB and RAWG. GamerCred isn’t affiliated with the games, studios or platforms shown; their names and artwork belong to their owners.',
      'GamerCred is built with open-source software; see Settings → About → Open-source licenses.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      'How we handle your data is described in the Privacy Policy (Settings → About).',
      'If these terms change in a meaningful way, you’ll be asked to accept the new version in the app.',
      `Questions or problems: ${SUPPORT_EMAIL}.`,
    ],
  },
];

/**
 * Privacy Policy (public at /privacy; Google Play needs its URL). Keep it true:
 * update it whenever the app collects something new or adds a service
 * provider, and bump PRIVACY_VERSION. Have it reviewed before launch.
 */
export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: 'The short version',
    paragraphs: [
      'GamerCred collects what it needs to run your account and show what you choose to share. There are no ads, no tracking across other apps or sites, no analytics, and we never sell your data.',
    ],
  },
  {
    title: 'What we collect',
    paragraphs: [
      'Account: your email address, password (stored only as a secure hash by our database provider), username and display name. If you sign in with Google, we receive your email address from Google.',
      'What you add: your profile picture, ratings, reviews and drafts, comments, likes, lists, backlog, Now Playing, replays, favourites, platforms and PC specs, friends, blocks, reports you make, and your settings (theme, rating scale, privacy).',
      'Safety and security: when you accepted the terms, counters that limit how often actions can be repeated, and records of moderation decisions.',
      'We don’t collect your location, contacts, or device advertising ID.',
    ],
  },
  {
    title: 'What other players can see',
    paragraphs: [
      'Your username, display name, profile picture, ratings, published reviews, comments, public lists and activity are visible to other signed-in players (and guests), except players you block or who block you. Your Now Playing and backlog follow your choices in Settings → Privacy. Drafts, private lists, blocks, reports and your email address are never shown to other players.',
      'Likes on reviews and comments are private: only the writer sees how many they got.',
    ],
  },
  {
    title: 'Service providers',
    paragraphs: [
      'Supabase hosts our database, sign-in and server functions, which store and process the data above.',
      'Google Cloud Vision checks profile pictures for unsafe content before other players can see them. Only the picture is sent.',
      'Cloudflare Turnstile runs the “are you human?” check at sign-in, sign-up and guest sessions. It reads technical signals from your browser or device to tell people from bots.',
      'Resend sends account emails, such as sign-up confirmation and password reset. It receives your email address and the email’s content.',
      'Google, if you choose Sign in with Google.',
      'Game information comes from IGDB and RAWG through our server; your personal data is never sent to them.',
    ],
  },
  {
    title: 'On your device',
    paragraphs: [
      'Your sign-in session is kept in your device’s secure storage. Your theme and saved game details (titles and covers, so pages load quickly) are kept in the app’s local storage. Signing out ends the session.',
    ],
  },
  {
    title: 'Keeping and deleting your data',
    paragraphs: [
      'We keep your data while you have an account. Delete your account at any time in Settings → Delete Account (or on the account deletion page): your profile and everything you posted are deleted permanently.',
      'Reports and moderation records are kept for safety after an account is deleted; reports you made no longer show who made them.',
    ],
  },
  {
    title: 'Your rights',
    paragraphs: [
      'You can see and change most of your data in the app. To ask for a copy of your data, a correction, or deletion, email us. Depending on where you live, you may have further rights, including complaining to your data protection authority.',
      'GamerCred is not meant for children under 13, and we don’t knowingly collect their data.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      'If this policy changes in a meaningful way, we’ll tell you in the app.',
      `Questions or requests: ${SUPPORT_EMAIL}.`,
    ],
  },
];
