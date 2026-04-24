import { context } from '@devvit/client';
import { startTransition, useEffect, useState } from 'react';
import type {
  ApiErrorResponse,
  BootstrapResponse,
  FizzleResponse,
  LeaderboardEntry,
  MoveResponse,
  ResetResponse,
} from '../../shared/api';
import type { CellPosition, GameState } from '../../shared/game';

class RequestError extends Error {
  payload?: ApiErrorResponse;

  constructor(message: string, payload?: ApiErrorResponse) {
    super(message);
    this.name = 'RequestError';
    this.payload = payload;
  }
}

const request = async <T>(
  input: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T | ApiErrorResponse;
  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse;
    throw new RequestError(
      errorPayload.message ?? 'The request failed.',
      errorPayload,
    );
  }

  return payload as T;
};

export const useChainMerge = () => {
  const [state, setState] = useState<GameState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [username, setUsername] = useState<string | null>(context.username ?? null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPlay = Boolean(context.userId && context.postId);

  const syncFromError = (cause: unknown): void => {
    if (!(cause instanceof RequestError)) {
      setError('Something unexpected happened while talking to the server.');
      return;
    }

    const payload = cause.payload;
    if (payload?.state) {
      startTransition(() => {
        setState(payload.state ?? null);
        setLeaderboard(payload.leaderboard ?? []);
      });
    }

    setError(payload?.message ?? cause.message);
  };

  useEffect(() => {
    if (!canPlay) {
      setError('Sign in to Reddit to play and save your score.');
      setLoading(false);
      return;
    }

    const bootstrap = async () => {
      setLoading(true);
      try {
        const payload = await request<BootstrapResponse>('/api/game/bootstrap');
        startTransition(() => {
          setState(payload.state);
          setLeaderboard(payload.leaderboard);
          setUsername(payload.username);
        });
        setError(null);
      } catch (cause) {
        syncFromError(cause);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [canPlay]);

  const submitMove = async (path: CellPosition[]): Promise<MoveResponse | null> => {
    if (!state || submitting) {
      return null;
    }

    setSubmitting(true);
    try {
      const payload = await request<MoveResponse>('/api/game/move', {
        method: 'POST',
        body: JSON.stringify({
          path,
          revision: state.revision,
        }),
      });

      startTransition(() => {
        setState(payload.state);
        setLeaderboard(payload.leaderboard);
      });
      setError(null);
      return payload;
    } catch (cause) {
      syncFromError(cause);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const submitFizzle = async (): Promise<FizzleResponse | null> => {
    if (!state || submitting) {
      return null;
    }

    setSubmitting(true);
    try {
      const payload = await request<FizzleResponse>('/api/game/fizzle', {
        method: 'POST',
        body: JSON.stringify({
          revision: state.revision,
        }),
      });

      startTransition(() => {
        setState(payload.state);
        setLeaderboard(payload.leaderboard);
      });
      setError(null);
      return payload;
    } catch (cause) {
      syncFromError(cause);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const resetGame = async (): Promise<ResetResponse | null> => {
    if (submitting) {
      return null;
    }

    setSubmitting(true);
    try {
      const payload = await request<ResetResponse>('/api/game/reset', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      startTransition(() => {
        setState(payload.state);
        setLeaderboard(payload.leaderboard);
      });
      setError(null);
      return payload;
    } catch (cause) {
      syncFromError(cause);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    canPlay,
    error,
    leaderboard,
    loading,
    resetGame,
    state,
    submitting,
    submitFizzle,
    submitMove,
    username,
  };
};
