import './styles.css';
import { context, requestExpandedMode } from '@devvit/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const Splash = () => (
  <div className="splash-shell splash-shell--compact">
    <div className="bg-orb orb-a" />
    <div className="bg-orb orb-b" />
    <section className="splash-card splash-card--compact">
      <p className="eyebrow">Tap to Play</p>
      <h1>Chain Merge</h1>
      <p className="subtle">
        Open the full game to start a run.
      </p>

      <div className="splash-pills">
        <span className="player-pill">5x5 board</span>
        <span className="player-pill">Global post leaderboard</span>
      </div>

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>,
);
