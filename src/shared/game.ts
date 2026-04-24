export type Board = number[][];

export interface CellPosition {
  row: number;
  col: number;
}

export interface LastMoveSummary {
  kind: 'merge' | 'fizzle';
  chainLength: number;
  gain: number;
  createdValue: number | null;
  playedAt: string;
}

export type GameStatus = 'playing' | 'gameover';

export interface GameState {
  schemaVersion: 1;
  revision: number;
  boardSize: number;
  board: Board;
  score: number;
  moves: number;
  mistakes: number;
  combo: number;
  bestCombo: number;
  bestChain: number;
  maxTile: number;
  target: number;
  lastGain: number;
  status: GameStatus;
  lastMove: LastMoveSummary | null;
}

export const GAME_CONFIG = {
  boardSize: 5,
  minChainLength: 2,
  startingTiles: 12,
  successSpawns: 2,
  failureSpawns: 1,
  targetTile: 100,
  spawnPool: [1, 1, 1, 1, 1, 2, 2, 2, 3, 3],
} as const;

type RandomFn = () => number;

export const cellKey = ({ row, col }: CellPosition): string => `${row}:${col}`;

export const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

export const createEmptyBoard = (boardSize: number = GAME_CONFIG.boardSize): Board =>
  Array.from({ length: boardSize }, () => Array(boardSize).fill(0));


export const isWithinBounds = (
  board: Board,
  { row, col }: CellPosition,
): boolean => row >= 0 && row < board.length && col >= 0 && col < board[0].length;

export const isAdjacent = (from: CellPosition, to: CellPosition): boolean => {
  const rowDelta = Math.abs(from.row - to.row);
  const colDelta = Math.abs(from.col - to.col);
  return rowDelta <= 1 && colDelta <= 1 && (rowDelta !== 0 || colDelta !== 0);
};

export const getCellValue = (board: Board, { row, col }: CellPosition): number => {
  if (!isWithinBounds(board, { row, col })) {
    return 0;
  }

  return board[row][col];
};

export const getMaxTile = (board: Board): number => {
  let max = 0;
  for (const row of board) {
    for (const value of row) {
      if (value > max) {
        max = value;
      }
    }
  }
  return max;
};

export const getPathValues = (board: Board, path: CellPosition[]): number[] =>
  path.map((cell) => getCellValue(board, cell));

export const getCreatedValueForPath = (values: number[]): number =>
  values.length === 0 ? 0 : values[values.length - 1] + 1;

export const estimateGain = (state: GameState, values: number[]): number => {
  const createdValue = getCreatedValueForPath(values);
  const base = values.reduce((total, value) => total + value, 0) + createdValue;
  const comboMultiplier = 1 + state.combo * 0.25;
  return Math.round(((base * values.length) / 2) * comboMultiplier);
};

const drawSpawnValue = (random: RandomFn): number => {
  const index = Math.floor(random() * GAME_CONFIG.spawnPool.length);
  return GAME_CONFIG.spawnPool[index] ?? 1;
};

const getEmptyCells = (board: Board): CellPosition[] => {
  const empty: CellPosition[] = [];

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] === 0) {
        empty.push({ row, col });
      }
    }
  }

  return empty;
};

const sampleIndex = (length: number, random: RandomFn): number => {
  if (length <= 1) {
    return 0;
  }

  return Math.floor(random() * length);
};

export const spawnRandomTiles = (
  board: Board,
  amount: number,
  random: RandomFn = Math.random,
): Board => {
  const nextBoard = cloneBoard(board);
  const empty = getEmptyCells(nextBoard);
  const toSpawn = Math.min(amount, empty.length);

  for (let index = 0; index < toSpawn; index += 1) {
    const pick = sampleIndex(empty.length, random);
    const [cell] = empty.splice(pick, 1);
    if (!cell) {
      continue;
    }

    nextBoard[cell.row][cell.col] = drawSpawnValue(random);
  }

  return nextBoard;
};

export const collapseBoard = (board: Board): Board => {
  const size = board.length;
  const nextBoard = createEmptyBoard(size);

  for (let col = 0; col < size; col += 1) {
    const values: number[] = [];
    for (let row = size - 1; row >= 0; row -= 1) {
      const value = board[row][col];
      if (value > 0) {
        values.push(value);
      }
    }

    for (let row = size - 1; row >= 0; row -= 1) {
      nextBoard[row][col] = values[size - 1 - row] ?? 0;
    }
  }

  return nextBoard;
};

const forceOpeningChain = (board: Board, random: RandomFn): Board => {
  const nextBoard = cloneBoard(board);
  const row = sampleIndex(nextBoard.length, random);
  const startCol = sampleIndex(nextBoard.length - 1, random);

  nextBoard[row][startCol] = 1;
  nextBoard[row][startCol + 1] = 2;

  return nextBoard;
};

export const isExtensionValid = (
  board: Board,
  path: CellPosition[],
  candidate: CellPosition,
): boolean => {
  if (!isWithinBounds(board, candidate)) {
    return false;
  }

  const candidateValue = getCellValue(board, candidate);
  if (candidateValue <= 0) {
    return false;
  }

  if (path.length === 0) {
    return true;
  }

  if (path.some((cell) => cellKey(cell) === cellKey(candidate))) {
    return false;
  }

  const previous = path[path.length - 1];
  if (!previous || !isAdjacent(previous, candidate)) {
    return false;
  }

  return candidateValue === getCellValue(board, previous) + 1;
};

export const isPathValid = (board: Board, path: CellPosition[]): boolean => {
  if (path.length < GAME_CONFIG.minChainLength) {
    return false;
  }

  for (let index = 0; index < path.length; index += 1) {
    const current = path[index];
    if (!isWithinBounds(board, current)) {
      return false;
    }

    const value = getCellValue(board, current);
    if (value <= 0) {
      return false;
    }

    for (let visited = 0; visited < index; visited += 1) {
      if (cellKey(path[visited]) === cellKey(current)) {
        return false;
      }
    }

    if (index === 0) {
      continue;
    }

    const previous = path[index - 1];
    if (!isAdjacent(previous, current)) {
      return false;
    }

    if (value !== getCellValue(board, previous) + 1) {
      return false;
    }
  }

  return true;
};

export const hasValidMove = (board: Board): boolean => {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const origin = board[row][col];
      if (origin <= 0) {
        continue;
      }

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          if (rowOffset === 0 && colOffset === 0) {
            continue;
          }

          const neighborRow = row + rowOffset;
          const neighborCol = col + colOffset;
          if (neighborRow < 0 || neighborRow >= board.length) {
            continue;
          }

          if (neighborCol < 0 || neighborCol >= board[row].length) {
            continue;
          }

          if (board[neighborRow][neighborCol] === origin + 1) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

export const createInitialState = (random: RandomFn = Math.random): GameState => {
  let board = createEmptyBoard(GAME_CONFIG.boardSize);
  board = spawnRandomTiles(board, GAME_CONFIG.startingTiles, random);

  if (!hasValidMove(board)) {
    board = forceOpeningChain(board, random);
  }

  return {
    schemaVersion: 1,
    revision: 1,
    boardSize: GAME_CONFIG.boardSize,
    board,
    score: 0,
    moves: 0,
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    bestChain: 0,
    maxTile: getMaxTile(board),
    target: GAME_CONFIG.targetTile,
    lastGain: 0,
    status: hasValidMove(board) ? 'playing' : 'gameover',
    lastMove: null,
  };
};

export interface AppliedMove {
  state: GameState;
  pathValues: number[];
  createdValue: number;
  gain: number;
}

export const applySuccessfulMove = (
  state: GameState,
  path: CellPosition[],
  random: RandomFn = Math.random,
): AppliedMove => {
  if (!isPathValid(state.board, path)) {
    throw new Error('The submitted chain is not valid for the current board.');
  }

  const pathValues = getPathValues(state.board, path);
  const createdValue = getCreatedValueForPath(pathValues);
  const gain = estimateGain(state, pathValues);
  const nextBoard = cloneBoard(state.board);

  for (const cell of path) {
    nextBoard[cell.row][cell.col] = 0;
  }

  const anchor = path[path.length - 1];
  nextBoard[anchor.row][anchor.col] = createdValue;

  const collapsed = collapseBoard(nextBoard);
  const replenished = spawnRandomTiles(collapsed, GAME_CONFIG.successSpawns, random);
  const nextCombo = state.combo + 1;

  return {
    pathValues,
    createdValue,
    gain,
    state: {
      ...state,
      revision: state.revision + 1,
      board: replenished,
      score: state.score + gain,
      moves: state.moves + 1,
      combo: nextCombo,
      bestCombo: Math.max(state.bestCombo, nextCombo),
      bestChain: Math.max(state.bestChain, path.length),
      maxTile: Math.max(state.maxTile, getMaxTile(replenished), createdValue),
      lastGain: gain,
      status: hasValidMove(replenished) ? 'playing' : 'gameover',
      lastMove: {
        kind: 'merge',
        chainLength: path.length,
        gain,
        createdValue,
        playedAt: new Date().toISOString(),
      },
    },
  };
};

export const applyFailedMove = (
  state: GameState,
  random: RandomFn = Math.random,
): GameState => {
  const nextBoard = spawnRandomTiles(state.board, GAME_CONFIG.failureSpawns, random);

  return {
    ...state,
    revision: state.revision + 1,
    board: nextBoard,
    moves: state.moves + 1,
    mistakes: state.mistakes + 1,
    combo: 0,
    lastGain: 0,
    maxTile: Math.max(state.maxTile, getMaxTile(nextBoard)),
    status: hasValidMove(nextBoard) ? 'playing' : 'gameover',
    lastMove: {
      kind: 'fizzle',
      chainLength: 0,
      gain: 0,
      createdValue: null,
      playedAt: new Date().toISOString(),
    },
  };
};
