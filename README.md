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

