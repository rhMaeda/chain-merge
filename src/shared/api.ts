import type { CellPosition, GameState } from './game';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
}

export interface BootstrapResponse {
  type: 'bootstrap';
  state: GameState;
  leaderboard: LeaderboardEntry[];
  username: string | null;
}

export interface MoveRequest {
  path: CellPosition[];
  revision: number;
}

export interface MoveResponse {
  type: 'move';
  state: GameState;
  leaderboard: LeaderboardEntry[];
  pathValues: number[];
  createdValue: number;
  gain: number;
}

export interface FizzleRequest {
  revision: number;
}

export interface FizzleResponse {
  type: 'fizzle';
  state: GameState;
  leaderboard: LeaderboardEntry[];
}

export interface ResetResponse {
  type: 'reset';
  state: GameState;
  leaderboard: LeaderboardEntry[];
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  code?: 'stale_state' | 'invalid_move' | 'missing_context';
  state?: GameState;
  leaderboard?: LeaderboardEntry[];
}

