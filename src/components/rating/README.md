# Quick ratings vs. reviews

GamerCred has two separate actions with separate code paths:

| | Quick rating | Full review |
|---|---|---|
| What | One overall score per game, entered in **your chosen scale** (Settings): 1–100, Tier, Stars (½ steps) or Rounded /10 | Score + written review (draft or published), entered in the same chosen scale |
| Where it's set | The **game page** hero only (`QuickRating`). Game lists (search, studio pages, user lists) show no ratings; tapping a game opens its page | **Review Studio** only (Post tab) |
| Visibility | **Public** (migration 000016). Shown on the player's profile (**Ratings** panel), in **Friends' Ratings** on game pages, and in the **Gamer Cred score** average. Never in the profile's Reviews list or the activity feed: a rating is not a review. | Published reviews are public, as before. Drafts are author-only. |
| Played on | Platform picker under the rating (game page). Defaults to the game's **earliest release platform** in the catalog. | The review form's platform picker. A new review starts on the rating's platform. |
| Table | `public.game_ratings` (migrations 000015–000016; public read, owner-only write) | `public.reviews` |
| Code | `services/ratings.ts` → `rateGame`, `clearGameRating`, `fetchMyRatings`; `hooks/useRatings.ts` → `useRateGame`, `useMyGameRatings` | `services/reviews.ts` → `saveReview`; `hooks/useReviews.ts` → `useSaveReview` |

## One score per game

A user's quick rating and the score on their review of the same game are always the same number, and since 000016 the same "played on" platform too. Two triggers keep them in sync (a "not specified" platform on either side keeps the other's):
- Saving a review with a score sets the quick rating.
- Changing the stars updates the score on the review.
- A new review starts from the quick rating.
- Clearing the stars is refused while a **published** review exists, because published reviews need a score. A draft's score is cleared along with the stars.
- Deleting a review keeps the quick rating.

Both controls use the viewer's primary scale (`usePrimaryRatingScale`, Settings → Rating scale):
- **Stars:** tap a half or full star.
- **Tier:** tap a tier chip, in the tier colours.
- **Rounded:** tap 5–10 or NOT GOOD.
- **1–100:** type a score and press Enter, or tap − / +.

The value is stored as entered (canonical 1–100 + input scale + raw input), so it converts to every scale. A score entered on one scale shows in yours: a review rated `92` shows as A+, 4.5★ or 9/10.

## Where a review can be started (and nowhere else)

- **Review Studio**:
  - "Review a Game…",
  - a Now Playing slot's **Review** button,
  - **Resume** on a draft.
- **Game page**: the **Write a review** button in the hero (`components/game/WriteReviewButton.tsx`). It opens the Review Studio for that game.

The quick-rating controls never open, embed or suggest the review form, and there are no prompts after rating.

## Behaviour notes

- **Search:** one batched query loads the viewer's ratings for all visible results, using the `(user_id, game_id)` primary key.
- **Saving:**
  - Taps update the screen straight away and save in the background, debounced so the last tap wins.
  - Saves for the same game never overlap (`utils/ratingQueue.ts`).
  - A failure rolls the stars back and shows an error toast.
- **Keyboard (web):** ↑/↓ move to a better or worse value, ← → move along the chips as laid out, Enter sets, Delete clears, Escape cancels. For 1–100, type and press Enter. Screen readers get one adjustable control.
- **Signed out:** a tap remembers the rating, goes to sign-in and applies the rating afterwards (`useApplyPendingRating`). Search and game pages currently require sign-in, so this path is a safeguard.
- **Stats:** a game is "logged" if it has a quick rating or a review. Every score-based stat uses the one score. Platforms come from reviews, so quick-rated-only games show as Unknown.
