import { redis } from '@devvit/web/server';
import type { LeaderboardEntry } from '../../shared/api';
import {
  applyFailedMove,
  applySuccessfulMove,
  createInitialState,
  type CellPosition,
  type GameState,
} from '../../shared/game';

const STATE_PREFIX = 'chainmerge:v1:state';
const LEADERBOARD_PREFIX = 'chainmerge:v1:leaderboard';

const stateKey = (postId: string, userId: string): string =>
  `${STATE_PREFIX}:${postId}:${userId}`;

const leaderboardKey = (postId: string): string =>
  `${LEADERBOARD_PREFIX}:${postId}`;

const isGameState = (value: unknown): value is GameState => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<GameState>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.board) &&
    typeof candidate.revision === 'number' &&
    typeof candidate.score === 'number'
  );
};

export const loadGameState = async (
  postId: string,
  userId: string,
): Promise<GameState | null> => {
  const raw = await redis.get(stateKey(postId, userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isGameState(parsed) ? parsed : null;
  } catch (error) {
    console.error('Could not read the saved game state.', error);
    return null;
  }
};

export const saveGameState = async (
  postId: string,
  userId: string,
  state: GameState,
): Promise<void> => {
  await redis.set(stateKey(postId, userId), JSON.stringify(state));
};

export const getOrCreateGameState = async (
  postId: string,
  userId: string,
): Promise<GameState> => {
  const existing = await loadGameState(postId, userId);
  if (existing) {
    return existing;
  }

  const created = createInitialState();
  await saveGameState(postId, userId, created);
  return created;
};

export const resetGameState = async (
  postId: string,
  userId: string,
): Promise<GameState> => {
  const created = createInitialState();
  await saveGameState(postId, userId, created);
  return created;
};

export const applyMoveAndPersist = async (
  postId: string,
  userId: string,
  path: CellPosition[],
  revision: number,
):
  Promise<
    | { ok: true; state: GameState; pathValues: number[]; createdValue: number; gain: number }
    | { ok: false; state: GameState; code: 'stale_state' | 'invalid_move'; message: string }
  > => {
  const current = await getOrCreateGameState(postId, userId);
  if (current.revision !== revision) {
    return {
      ok: false,
      state: current,
      code: 'stale_state',
      message: 'Your board was out of date. We synced the latest turn.',
    };
  }

  try {
    const result = applySuccessfulMove(current, path);
    await saveGameState(postId, userId, result.state);
    return { ok: true, ...result };
  } catch (error) {
    console.error('Could not apply move.', error);
    return {
      ok: false,
      state: current,
      code: 'invalid_move',
      message: 'That chain does not match the board saved on the server.',
    };
  }
};

export const applyFizzleAndPersist = async (
  postId: string,
  userId: string,
  revision: number,
):
  Promise<
    | { ok: true; state: GameState }
    | { ok: false; state: GameState; code: 'stale_state'; message: string }
  > => {
  const current = await getOrCreateGameState(postId, userId);
  if (current.revision !== revision) {
    return {
      ok: false,
      state: current,
      code: 'stale_state',
      message: 'The turn changed before the penalty was applied. We synced the board.',
    };
  }

  const nextState = applyFailedMove(current);
  await saveGameState(postId, userId, nextState);
  return { ok: true, state: nextState };
};

export const updateLeaderboard = async (
  postId: string,
  username: string | null,
  score: number,
): Promise<void> => {
  if (!username) {
    return;
  }

  const key = leaderboardKey(postId);
  const currentBest = await redis.zScore(key, username);

  if (currentBest == null || score > currentBest) {
    await redis.zAdd(key, { member: username, score });
  }
};

export const getLeaderboard = async (
  postId: string,
  limit = 10,
): Promise<LeaderboardEntry[]> => {
  const key = leaderboardKey(postId);
  const total = await redis.zCard(key);

  if (total <= 0) {
    return [];
  }

  const start = Math.max(0, total - limit);
  const entries = await redis.zRange(key, start, total - 1, { by: 'rank' });

  return entries
    .map((entry, index) => ({
      rank: total - (start + index),
      username: entry.member,
      score: entry.score,
    }))
    .reverse();
};
