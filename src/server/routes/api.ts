import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  ApiErrorResponse,
  BootstrapResponse,
  FizzleRequest,
  FizzleResponse,
  MoveRequest,
  MoveResponse,
  ResetResponse,
} from '../../shared/api';
import {
  applyFizzleAndPersist,
  applyMoveAndPersist,
  getLeaderboard,
  getOrCreateGameState,
  resetGameState,
  updateLeaderboard,
} from '../core/game-service';

export const api = new Hono();

const readContext = () => {
  const { postId, userId } = context;
  if (!postId || !userId) {
    throw new Error('missing_context');
  }

  return { postId, userId };
};

const missingContextResponse = {
  status: 'error',
  code: 'missing_context',
  message: 'Sign in to Reddit to play this post.',
} satisfies ApiErrorResponse;

api.get('/game/bootstrap', async (c) => {
  try {
    const { postId, userId } = readContext();
    const [state, username, leaderboard] = await Promise.all([
      getOrCreateGameState(postId, userId),
      reddit.getCurrentUsername(),
      getLeaderboard(postId),
    ]);

    return c.json<BootstrapResponse>({
      type: 'bootstrap',
      state,
      leaderboard,
      username: username ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing_context') {
      return c.json<ApiErrorResponse>(missingContextResponse, 401);
    }

    console.error('Game bootstrap failed.', error);
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Could not load the board right now.',
      },
      500,
    );
  }
});

api.post('/game/move', async (c) => {
  try {
    const { postId, userId } = readContext();
    const body = await c.req.json<MoveRequest>();
    if (!Array.isArray(body.path) || typeof body.revision !== 'number') {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          code: 'invalid_move',
          message: 'Invalid move payload.',
        },
        400,
      );
    }

    const username = await reddit.getCurrentUsername();
    const result = await applyMoveAndPersist(postId, userId, body.path, body.revision);

    if (!result.ok) {
      const leaderboard = await getLeaderboard(postId);
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          code: result.code,
          message: result.message,
          state: result.state,
          leaderboard,
        },
        result.code === 'stale_state' ? 409 : 400,
      );
    }

    await updateLeaderboard(postId, username ?? null, result.state.score);
    const leaderboard = await getLeaderboard(postId);

    return c.json<MoveResponse>({
      type: 'move',
      state: result.state,
      leaderboard,
      pathValues: result.pathValues,
      createdValue: result.createdValue,
      gain: result.gain,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing_context') {
      return c.json<ApiErrorResponse>(missingContextResponse, 401);
    }

    console.error('Could not process move.', error);
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Could not validate your move.',
      },
      500,
    );
  }
});

api.post('/game/fizzle', async (c) => {
  try {
    const { postId, userId } = readContext();
    const body = await c.req.json<FizzleRequest>();
    if (typeof body.revision !== 'number') {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Invalid penalty payload.',
        },
        400,
      );
    }

    const username = await reddit.getCurrentUsername();
    const result = await applyFizzleAndPersist(postId, userId, body.revision);

    if (!result.ok) {
      const leaderboard = await getLeaderboard(postId);
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          code: result.code,
          message: result.message,
          state: result.state,
          leaderboard,
        },
        409,
      );
    }

    await updateLeaderboard(postId, username ?? null, result.state.score);
    const leaderboard = await getLeaderboard(postId);

    return c.json<FizzleResponse>({
      type: 'fizzle',
      state: result.state,
      leaderboard,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing_context') {
      return c.json<ApiErrorResponse>(missingContextResponse, 401);
    }

    console.error('Could not apply penalty.', error);
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Could not apply the broken-chain penalty.',
      },
      500,
    );
  }
});

api.post('/game/reset', async (c) => {
  try {
    const { postId, userId } = readContext();
    const [state, username] = await Promise.all([
      resetGameState(postId, userId),
      reddit.getCurrentUsername(),
    ]);

    await updateLeaderboard(postId, username ?? null, state.score);
    const leaderboard = await getLeaderboard(postId);

    return c.json<ResetResponse>({
      type: 'reset',
      state,
      leaderboard,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'missing_context') {
      return c.json<ApiErrorResponse>(missingContextResponse, 401);
    }

    console.error('Could not reset game.', error);
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'Could not start a new board.',
      },
      500,
    );
  }
});
