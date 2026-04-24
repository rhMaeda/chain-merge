export const GAME_RULES = [
  'Drag across adjacent tiles in ascending order.',
  'You cannot reuse a tile in the same move.',
  'A valid chain upgrades the final tile to the next value.',
  'Example: 1 -> 2 -> 3 becomes 4.',
  'Breaking the sequence costs the turn and spawns a new tile.',
  'Every move adds new tiles to the board.',
  'Aim for the highest tile and the highest score.',
] as const;

export const PINNED_COMMENT_TEXT = [
  '**How to play Chain Merge**',
  '',
  ...GAME_RULES.map((rule) => `- ${rule}`),
  '',
  'Open the game and drag across the board to submit a chain.',
].join('\n');

