# Chain Merge for Reddit with Devvit

Async Reddit puzzle game built with Node `22.2+`, Devvit Web, React, and server-side Node/Hono endpoints.

## What this version includes

- `5x5` board
- Random starting tiles from `1` to `3`
- Chains across adjacent tiles in `8 directions`
- Server-side move validation
- Progression rule:
  `1 -> 2 -> 3` becomes `4`
- Combo scoring for consecutive successful moves
- Broken-chain penalty with an extra spawned tile
- Per-user, per-post saved state in Devvit Redis
- Per-post leaderboard
- Stickied instructions comment created automatically with each new game post

## Structure

- `src/client`: splash screen and main game UI
- `src/server`: `/api/*` endpoints, post creation, and persistence
- `src/shared`: game rules, shared content, and API contracts

## How to run

1. Install Node `22.2+`
2. Run `npm install`
3. Run `npm run login -- --copy-paste` if the normal login callback port is blocked
4. Run `npm run dev`
5. In your playtest subreddit, use the moderator menu item `Create Chain Merge`
6. To publish, run `npm run launch`

## Notes

- The current app slug in `devvit.json` is `chain-merge-go`. Change it before your first public release if you want a different slug.
- The leaderboard is scoped per post, so every published thread is its own competition.
- The leaderboard stores the best score for each user on that post, even after the board is reset.
