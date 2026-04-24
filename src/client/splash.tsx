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
      <section className="splash-card splash-card--compact">
        <h1>Chain Merge</h1>
        <p className="splash-meta">Open the full game to play.</p>

        <button
          className="primary-button splash-button"
          type="button"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          Play now
        </button>

        <p className="splash-note">
          {context.username ? `u/${context.username}` : 'Sign in to save your score.'}
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
