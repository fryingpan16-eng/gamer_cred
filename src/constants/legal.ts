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

export const TERMS_VERSION = '2026-11-03';

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
    ],
  },
  {
    title: 'Your account',
    paragraphs: [
      'You must be old enough to use online services where you live (at least 13).',
      'You can delete your account at any time in Settings → Delete Account. This permanently deletes your profile and everything you posted. If you can’t use the app, see the account deletion page or email us.',
      'We may suspend or remove accounts that break these terms.',
    ],
  },
  {
    title: 'Game information',
    paragraphs: [
      'Game details come from IGDB and RAWG. GamerCred isn’t affiliated with the games, studios or platforms shown; their names and artwork belong to their owners.',
    ],
  },
  {
    title: 'Changes and contact',
    paragraphs: [
      'If these terms change in a meaningful way, you’ll be asked to accept the new version in the app.',
      `Questions or problems: ${SUPPORT_EMAIL}.`,
    ],
  },
];
