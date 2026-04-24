import './styles.css';
import { context, requestExpandedMode } from '@devvit/client';
import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';

const Splash = () => {
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    document.documentElement.classList.add('inline-html');
    document.body.classList.add('inline-body');
    root?.classList.add('inline-root');

    return () => {
      document.documentElement.classList.remove('inline-html');
      document.body.classList.remove('inline-body');
      root?.classList.remove('inline-root');
    };
  }, []);

  return (
    <div className="splash-shell splash-shell--compact">
      <div className="bg-orb orb-a" />
      <div className="bg-orb orb-b" />
      <section className="splash-card splash-card--compact">
        <p className="eyebrow">Tap to Play</p>
        <h1>Chain Merge</h1>
        <p className="subtle">
          Open the full game to start a run.
        </p>

        <p className="splash-meta">
          5x5 board | Post leaderboard is inside the game.
        </p>

        <button
          className="primary-button splash-button"
          type="button"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          Play now
        </button>

        <p className="splash-note">
          {context.username
            ? `Signed in as u/${context.username}.`
            : 'Sign in to Reddit to save your score.'}
        </p>
      </section>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>,
);
