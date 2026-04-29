import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeIconLink from '../components/HomeIconLink';
import '../styles/pages/art-crane-game.css';

type MoveDirection = 'right' | 'up';

const GRID_COLS = 10;
const GRID_ROWS = 6;
const LONG_PRESS_MS = 320;

export default function ArtCraneGame() {
  const [cursor, setCursor] = useState({ x: 0, y: GRID_ROWS - 1 });
  const [message, setMessage] = useState('右ボタン・上ボタンを長押しすると1マス移動します');

  const pressStateRef = useRef<Record<MoveDirection, { timer: number | null; moved: boolean }>>({
    right: { timer: null, moved: false },
    up: { timer: null, moved: false },
  });

  const cursorPositionStyle = useMemo(
    () => ({
      left: `${(cursor.x / (GRID_COLS - 1)) * 100}%`,
      top: `${(cursor.y / (GRID_ROWS - 1)) * 100}%`,
    }),
    [cursor.x, cursor.y],
  );

  const moveCursor = (direction: MoveDirection) => {
    setCursor((prev) => {
      if (direction === 'right') {
        return { ...prev, x: Math.min(prev.x + 1, GRID_COLS - 1) };
      }
      return { ...prev, y: Math.max(prev.y - 1, 0) };
    });
    setMessage(direction === 'right' ? '右へ1マス移動しました' : '上へ1マス移動しました');
  };

  const startLongPress = (direction: MoveDirection) => {
    const state = pressStateRef.current[direction];
    if (state.timer !== null) {
      return;
    }

    state.moved = false;
    state.timer = window.setTimeout(() => {
      if (state.moved) {
        return;
      }
      state.moved = true;
      moveCursor(direction);
    }, LONG_PRESS_MS);
  };

  const endLongPress = (direction: MoveDirection) => {
    const state = pressStateRef.current[direction];
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
    state.moved = false;
  };

  return (
    <main className="page feature-page art-crane-page">
      <div className="title-with-home">
        <HomeIconLink />
        <h1>絵画クレーンゲーム</h1>
      </div>

      <section className="art-crane-stage" aria-label="絵画クレーンゲーム盤面">
        <div className="art-crane-canvas-wrap">
          <div className="art-crane-canvas" role="img" aria-label="黒塗りされた絵画" />
          <div className="art-crane-dot" style={cursorPositionStyle} aria-label="現在位置" />
          <div className="art-crane-speech" aria-hidden>
            いくぜ
          </div>
        </div>
      </section>

      <section className="art-crane-question" aria-label="問題と操作">
        <p className="art-crane-question-text">『神奈川沖浪裏』の富士山はどこ？</p>
        <div className="art-crane-controls">
          <button
            type="button"
            className="move-btn move-btn-right"
            aria-label="右へ移動（長押し）"
            onPointerDown={() => startLongPress('right')}
            onPointerUp={() => endLongPress('right')}
            onPointerLeave={() => endLongPress('right')}
            onPointerCancel={() => endLongPress('right')}
          >
            →
          </button>
          <button
            type="button"
            className="move-btn move-btn-up"
            aria-label="上へ移動（長押し）"
            onPointerDown={() => startLongPress('up')}
            onPointerUp={() => endLongPress('up')}
            onPointerLeave={() => endLongPress('up')}
            onPointerCancel={() => endLongPress('up')}
          >
            ↑
          </button>
        </div>
      </section>

      <p className="art-crane-message" aria-live="polite">
        {message}
      </p>

      <Link to="/" className="back-link">
        ← ホームへ戻る
      </Link>
    </main>
  );
}
