import './styles.css';
import {
  StrictMode,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import { GAME_RULES } from '../shared/content';
import {
  cellKey,
  estimateGain,
  GAME_CONFIG,
  getCreatedValueForPath,
  getPathValues,
  isExtensionValid,
  type CellPosition,
} from '../shared/game';
import { useChainMerge } from './hooks/useChainMerge';

type OverlayPanel = 'instructions' | 'leaderboard' | null;

const getTileStyle = (value: number): CSSProperties | undefined => {
  if (value <= 0) {
    return undefined;
  }

  const hue = (value * 29) % 360;
  const lightA = Math.min(34 + value * 2, 66);
  const lightB = Math.min(lightA + 12, 78);

  return {
    background: `linear-gradient(145deg, hsl(${hue} 88% ${lightA}%), hsl(${(hue + 24) % 360} 92% ${lightB}%))`,
    boxShadow: `0 14px 28px hsl(${hue} 72% 18% / 0.28), inset 0 1px 0 rgba(255,255,255,0.28)`,
  };
};

const computeCandidateKeys = (
  board: number[][],
  path: CellPosition[],
): Set<string> => {
  const candidates = new Set<string>();
  if (path.length === 0) {
    return candidates;
  }

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const cell = { row, col };
      if (isExtensionValid(board, path, cell)) {
        candidates.add(cellKey(cell));
      }
    }
  }

  return candidates;
};

const LoadingScreen = () => (
  <div className="loading-shell">
    <div className="bg-orb orb-a" />
    <div className="bg-orb orb-b" />
    <p className="eyebrow">Loading game</p>
    <h1>Chain Merge</h1>
    <p className="subtle">Preparing your board and saved Reddit state.</p>
    <div className="loading-bar" />
  </div>
);

const UnavailableScreen = ({ message }: { message: string }) => (
  <div className="loading-shell">
    <div className="bg-orb orb-a" />
    <div className="bg-orb orb-b" />
    <p className="eyebrow">Game unavailable</p>
    <h1>Chain Merge</h1>
    <p className="subtle">{message}</p>
    <section className="panel">
      <ul className="rule-list">
        <li>Open the full game view to play.</li>
        <li>Sign in with Reddit to save your score.</li>
        <li>The stickied comment below the post explains the rules.</li>
      </ul>
    </section>
  </div>
);

const Overlay = ({
  leaderboard,
  mode,
  onClose,
}: {
  leaderboard: ReturnType<typeof useChainMerge>['leaderboard'];
  mode: Exclude<OverlayPanel, null>;
  onClose: () => void;
}) => (
  <div
    className="overlay-backdrop"
    role="presentation"
    onClick={onClose}
  >
    <section
      className="panel overlay-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="overlay-panel__header">
        <div>
          <p className="eyebrow">{mode === 'instructions' ? 'Quick rules' : 'Top runs'}</p>
          <h2 id="overlay-title">
            {mode === 'instructions' ? 'How to Play' : 'Leaderboard'}
          </h2>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {mode === 'instructions' ? (
        <>
          <ul className="rule-list">
            {GAME_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="status-text">
            The same rules are also in the stickied comment below the post.
          </p>
        </>
      ) : leaderboard.length > 0 ? (
        <ol className="leaderboard">
          {leaderboard.map((entry) => (
            <li key={`${entry.rank}-${entry.username}`}>
              <span className="leaderboard__rank">#{entry.rank}</span>
              <span className="leaderboard__name">u/{entry.username}</span>
              <span className="leaderboard__score">{entry.score}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="empty-state">
          <p className="subtle">No scores yet. Be the first run on this post.</p>
        </div>
      )}
    </section>
  </div>
);

const GameApp = () => {
  const {
    canPlay,
    error,
    leaderboard,
    loading,
    resetGame,
    state,
    submitting,
    submitFizzle,
    submitMove,
  } = useChainMerge();
  const [dragPath, setDragPath] = useState<CellPosition[]>([]);
  const [brokenCell, setBrokenCell] = useState<CellPosition | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<OverlayPanel>(null);

  const dragPathRef = useRef<CellPosition[]>([]);
  const brokenCellRef = useRef<CellPosition | null>(null);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const finalizingRef = useRef(false);

  const syncPath = (nextPath: CellPosition[]) => {
    dragPathRef.current = nextPath;
    setDragPath(nextPath);
  };

  const syncBrokenCell = (nextBrokenCell: CellPosition | null) => {
    brokenCellRef.current = nextBrokenCell;
    setBrokenCell(nextBrokenCell);
  };

  const clearSelection = () => {
    syncPath([]);
    syncBrokenCell(null);
  };

  const beginDrag = (
    cell: CellPosition,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!state || state.status !== 'playing' || !canPlay || submitting || draggingRef.current) {
      return;
    }

    event.preventDefault();
    draggingRef.current = true;
    pointerIdRef.current = event.pointerId;
    finalizingRef.current = false;
    syncPath([cell]);
    syncBrokenCell(null);
    setMessage(null);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const extendPathFromPointer = useEffectEvent((clientX: number, clientY: number) => {
    if (!draggingRef.current || !state || state.status !== 'playing' || brokenCellRef.current) {
      return;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const cellElement =
      element instanceof Element
        ? element.closest<HTMLElement>('[data-chain-cell="true"]')
        : null;

    if (!cellElement) {
      return;
    }

    const row = Number(cellElement.dataset.row);
    const col = Number(cellElement.dataset.col);
    if (Number.isNaN(row) || Number.isNaN(col)) {
      return;
    }

    const nextCell = { row, col };
    const currentPath = dragPathRef.current;
    const previous = currentPath[currentPath.length - 1];

    if (!previous || cellKey(previous) === cellKey(nextCell)) {
      return;
    }

    if (!isExtensionValid(state.board, currentPath, nextCell)) {
      syncBrokenCell(nextCell);
      return;
    }

    syncPath([...currentPath, nextCell]);
  });

  const finalizeDrag = useEffectEvent(async () => {
    if (!draggingRef.current || finalizingRef.current) {
      return;
    }

    draggingRef.current = false;
    finalizingRef.current = true;

    const currentPath = [...dragPathRef.current];
    const didBreak = Boolean(brokenCellRef.current);
    clearSelection();

    if (!state || !canPlay) {
      finalizingRef.current = false;
      return;
    }

    if (didBreak) {
      const result = await submitFizzle();
      if (result) {
        setMessage('Broken chain: you lost the turn and a new tile entered the board.');
      }
      finalizingRef.current = false;
      return;
    }

    if (currentPath.length < GAME_CONFIG.minChainLength) {
      setMessage('Start with at least 2 consecutive numbers.');
      finalizingRef.current = false;
      return;
    }

    const result = await submitMove(currentPath);
    if (result) {
      setMessage(
        `${result.pathValues.join(' -> ')} became ${result.createdValue} and scored +${result.gain}.`,
      );
    }
    finalizingRef.current = false;
  });

  useEffect(() => {
    if (dragPath.length === 0) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) {
        return;
      }

      extendPathFromPointer(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (pointerIdRef.current != null && event.pointerId !== pointerIdRef.current) {
        return;
      }

      pointerIdRef.current = null;
      void finalizeDrag();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerEnd, { passive: true });
    window.addEventListener('pointercancel', handlePointerEnd, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [dragPath.length]);

  useEffect(() => {
    if (!activeOverlay) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveOverlay(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeOverlay]);

  if (loading || !state) {
    if (!loading && !state) {
      return (
        <UnavailableScreen
          message={error ?? 'Could not load this match right now.'}
        />
      );
    }

    return <LoadingScreen />;
  }

  const candidateKeys =
    !brokenCell && dragPath.length > 0
      ? computeCandidateKeys(state.board, dragPath)
      : new Set<string>();
  const activeValues = getPathValues(state.board, dragPath);
  const createdValue =
    activeValues.length >= GAME_CONFIG.minChainLength
      ? getCreatedValueForPath(activeValues)
      : null;
  const previewGain =
    createdValue != null ? estimateGain(state, activeValues) : null;
  const statusText =
    error ??
    message ??
    (state.status === 'gameover' ? 'Game over.' : 'Ready');
  const footerMessage = brokenCell
    ? 'Broken chain. Release to lose the turn.'
    : activeValues.length > 0
      ? `${activeValues.join(' -> ')}${
          createdValue != null ? ` = ${createdValue}  |  +${previewGain ?? 0}` : ''
        }`
      : statusText === 'Ready'
        ? null
        : statusText;

  return (
    <div className="app-shell app-shell--playfield">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <div className="bg-orb orb-c" />

      <main className="game-layout game-layout--playfield">
        <section className="panel playfield-stage">
          <div className="playfield-toolbar">
            <div className="hud-strip">
              <div className="hud-pill">
                <span className="hud-pill__label">Score</span>
                <strong>{state.score}</strong>
              </div>
              <div className="hud-pill">
                <span className="hud-pill__label">Combo</span>
                <strong>x{Math.max(1, state.combo)}</strong>
              </div>
              <div className="hud-pill">
                <span className="hud-pill__label">Best</span>
                <strong>{state.maxTile}</strong>
              </div>
            </div>

            <div className="action-strip action-strip--toolbar">
              <button
                className="ghost-button ghost-button--compact"
                type="button"
                onClick={() => setActiveOverlay('instructions')}
              >
                Rules
              </button>
              <button
                className="ghost-button ghost-button--compact"
                type="button"
                onClick={() => setActiveOverlay('leaderboard')}
              >
                Scores
              </button>
              <button
                className="ghost-button ghost-button--compact"
                type="button"
                onClick={() => void resetGame()}
              >
                New
              </button>
            </div>
          </div>

          <div className="board-wrap">
            <div className="board-frame">
              <div className={`board ${submitting ? 'board--busy' : ''}`}>
                {state.board.map((row, rowIndex) =>
                  row.map((value, colIndex) => {
                    const cell = { row: rowIndex, col: colIndex };
                    const key = cellKey(cell);
                    const selectedIndex = dragPath.findIndex(
                      (item) => cellKey(item) === key,
                    );
                    const isSelected = selectedIndex >= 0;
                    const isCandidate = candidateKeys.has(key);
                    const isBroken = brokenCell ? cellKey(brokenCell) === key : false;

                    return (
                      <button
                        key={key}
                        className={[
                          'tile',
                          value <= 0 ? 'tile--empty' : '',
                          isSelected ? 'tile--selected' : '',
                          isCandidate ? 'tile--candidate' : '',
                          isBroken ? 'tile--broken' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        type="button"
                        data-chain-cell="true"
                        data-row={rowIndex}
                        data-col={colIndex}
                        style={getTileStyle(value)}
                        disabled={!canPlay || submitting || state.status === 'gameover' || value <= 0}
                        onPointerDown={(event) => beginDrag(cell, event)}
                      >
                        {value > 0 ? (
                          <span className="tile__value">{value}</span>
                        ) : (
                          <span className="tile__ghost">+</span>
                        )}
                        {isSelected ? (
                          <span className="tile__order">{selectedIndex + 1}</span>
                        ) : null}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          </div>

          <div className="playfield-footer">
            {footerMessage ? (
              <p
                className={[
                  'footer-message',
                  brokenCell || state.status === 'gameover' ? 'footer-message--danger' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {footerMessage}
              </p>
            ) : (
              <div aria-hidden="true" className="footer-spacer" />
            )}

            {state.status === 'gameover' ? (
              <button
                className="primary-button primary-button--compact"
                type="button"
                onClick={() => void resetGame()}
              >
                Play again
              </button>
            ) : null}
          </div>
        </section>
      </main>

      {activeOverlay ? (
        <Overlay
          leaderboard={leaderboard}
          mode={activeOverlay}
          onClose={() => setActiveOverlay(null)}
        />
      ) : null}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GameApp />
  </StrictMode>,
);
