import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HomeIconLink from '../components/HomeIconLink';
import ToroScene from '../components/ToroScene';
import { useToroInput } from '../hooks/useToroInput';
import { useToroSound } from '../hooks/useToroSound';
import { COLLECTION, discoveredIds, parseSentence, sentenceLabel, type Kana } from '../lib/toroParser';
import '../styles/pages/toro-game.css';

const STORAGE_KEY = 'toro-discovered';
const HISTORY_SIZE = 5;

const loadDiscovered = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};

export default function ToroGame() {
  const playSound = useToroSound();
  const [history, setHistory] = useState<string[]>([]);
  const [discovered, setDiscovered] = useState<Set<string>>(loadDiscovered);
  const [pressed, setPressed] = useState<Kana | null>(null);
  const activePointer = useRef<number | null>(null);

  const onClose = useCallback((text: string, id: number) => {
    const s = parseSentence(text, id);
    if (s) setHistory((h) => [sentenceLabel(s), ...h].slice(0, HISTORY_SIZE));
  }, []);
  const { state, press } = useToroInput(onClose);

  const sentence = useMemo(() => parseSentence(state.text, state.sentenceId), [state.text, state.sentenceId]);

  useEffect(() => {
    if (!sentence) return;
    const ids = discoveredIds(sentence).filter((id) => !discovered.has(id));
    if (ids.length === 0) return;
    const next = new Set([...discovered, ...ids]);
    setDiscovered(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* 保存できなくても遊べる */
    }
  }, [sentence, discovered]);

  const hit = useCallback(
    (kana: Kana) => {
      playSound(kana);
      press(kana);
    },
    [playSound, press],
  );

  // PC 用: T キー = と、R キー = ろ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 't') hit('と');
      if (k === 'r') hit('ろ');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hit]);

  const buttonProps = (kana: Kana) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // 同時押しは受け付けない（片方を押している間はもう片方を無視）
      if (activePointer.current !== null && activePointer.current !== e.pointerId) return;
      activePointer.current = e.pointerId;
      setPressed(kana);
      hit(kana);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (activePointer.current === e.pointerId) {
        activePointer.current = null;
        setPressed(null);
      }
    },
    onPointerCancel: () => {
      activePointer.current = null;
      setPressed(null);
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const found = COLLECTION.filter((c) => discovered.has(c.id)).length;

  return (
    <main className="toro-page">
      <header className="toro-header">
        <HomeIconLink label="ホームに戻る" />
        <h1>とろ</h1>
        <span className="toro-count">
          図鑑 {found}/{COLLECTION.length}
        </span>
      </header>

      <section className="toro-scene" aria-live="polite">
        <ToroScene key={state.sentenceId} sentence={sentence} />
      </section>

      <section className={`toro-typed${state.closed ? ' is-closed' : ''}`}>
        <p className="toro-typed-text">{state.text || '　'}</p>
        <div className="toro-timer">
          {!state.closed && <span key={state.pressCount} className="toro-timer-bar" />}
        </div>
      </section>

      <div className="toro-buttons">
        {(['と', 'ろ'] as Kana[]).map((kana) => (
          <button
            key={kana}
            type="button"
            className={`toro-button toro-button-${kana === 'と' ? 'to' : 'ro'}${pressed === kana ? ' is-pressed' : ''}`}
            {...buttonProps(kana)}
          >
            {kana}
          </button>
        ))}
      </div>

      <details className="toro-extra">
        <summary>図鑑・履歴</summary>
        <ul className="toro-collection">
          {COLLECTION.map((c) =>
            discovered.has(c.id) ? (
              <li key={c.id}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </li>
            ) : (
              <li key={c.id} className="is-unknown">
                ？？？ <small>({c.hint.replace(/[とろ]/g, '・')})</small>
              </li>
            ),
          )}
        </ul>
        {history.length > 0 && (
          <ol className="toro-history">
            {history.map((h, i) => (
              <li key={`${i}-${h}`}>{h}</li>
            ))}
          </ol>
        )}
      </details>
    </main>
  );
}
