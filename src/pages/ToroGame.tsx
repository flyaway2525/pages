import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HomeIconLink from '../components/HomeIconLink';
import ToroResult, { type ToroResultData } from '../components/ToroResult';
import ToroScene from '../components/ToroScene';
import ToroTyped from '../components/ToroTyped';
import { useToroInput } from '../hooks/useToroInput';
import { useToroSound } from '../hooks/useToroSound';
import {
  COLLECTION,
  discoveredIds,
  parseSentence,
  sentenceLabel,
  sentenceScore,
  sentenceSoundSequence,
  type Kana,
  type Sentence,
} from '../lib/toroParser';
import '../styles/pages/toro-game.css';

const STORAGE_KEY = 'toro-discovered';
const BEST_KEY = 'toro-best';
const HISTORY_SIZE = 5;

const loadDiscovered = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};

const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 保存できなくても遊べる */
  }
};

export default function ToroGame() {
  const { play, playSequence, stop } = useToroSound();
  const [history, setHistory] = useState<string[]>([]);
  const [discovered, setDiscovered] = useState<Set<string>>(loadDiscovered);
  const [pressed, setPressed] = useState<Kana | null>(null);
  const [result, setResult] = useState<ToroResultData | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const activePointer = useRef<number | null>(null);
  const bestRef = useRef(loadBest());
  const timersRef = useRef<number[]>([]);
  const resultOpenRef = useRef(false);
  resultOpenRef.current = result !== null;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  // 全文をつなげて読み上げ、読んでいる画像をハイライトする
  const readAloud = useCallback(
    (s: Sentence) => {
      clearTimers();
      const timings = playSequence(sentenceSoundSequence(s));
      setPlaying(true);
      const later = (ms: number, fn: () => void) => timersRef.current.push(window.setTimeout(fn, ms));
      timings.forEach((t) => later(t.startMs, () => setActiveIndex(t.phraseIndex)));
      const endMs = timings.length ? timings[timings.length - 1].endMs : 0;
      later(endMs + 100, () => {
        setActiveIndex(-1);
        setPlaying(false);
      });
    },
    [clearTimers, playSequence],
  );

  // 1 秒入力がなかったらリザルトへ
  const onClose = useCallback(
    (text: string, id: number) => {
      const s = parseSentence(text, id);
      if (!s) return;
      const score = sentenceScore(s);
      const isNewBest = score > bestRef.current;
      if (isNewBest) {
        bestRef.current = score;
        save(BEST_KEY, String(score));
      }
      setHistory((h) => [`${sentenceLabel(s)}（${score}pt）`, ...h].slice(0, HISTORY_SIZE));
      setResult({ text, sentence: s, score, best: bestRef.current, isNewBest });
      readAloud(s);
    },
    [readAloud],
  );
  const { state, press, reset } = useToroInput(onClose);

  const sentence = useMemo(() => parseSentence(state.text, state.sentenceId), [state.text, state.sentenceId]);

  useEffect(() => {
    if (!sentence) return;
    const ids = discoveredIds(sentence).filter((id) => !discovered.has(id));
    if (ids.length === 0) return;
    const next = new Set([...discovered, ...ids]);
    setDiscovered(next);
    save(STORAGE_KEY, JSON.stringify([...next]));
  }, [sentence, discovered]);

  useEffect(() => clearTimers, [clearTimers]);

  const retry = useCallback(() => {
    stop();
    clearTimers();
    setActiveIndex(-1);
    setPlaying(false);
    setResult(null);
    reset();
  }, [clearTimers, reset, stop]);

  const hit = useCallback(
    (kana: Kana) => {
      if (resultOpenRef.current) return; // リザルト表示中は入力しない
      // 押した結果できた文の、最後の単語の声を鳴らす（と → 戸、続けて ろ → トロ）
      const next = press(kana);
      const parsed = parseSentence(next.text, next.sentenceId);
      play(parsed?.phrases.at(-1)?.word.sound, kana);
    },
    [play, press],
  );

  // PC 用: T キー = と、R キー = ろ、リザルトでは Enter / Space でもう一回
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 't') hit('と');
      if (k === 'r') hit('ろ');
      if ((k === 'enter' || k === ' ') && resultOpenRef.current) {
        e.preventDefault();
        retry();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hit, retry]);

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

      <section className="toro-typed">
        <ToroTyped text={state.text} closed={state.closed} />
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

      {result && (
        <ToroResult
          result={result}
          activeIndex={activeIndex}
          playing={playing}
          onReplay={() => readAloud(result.sentence)}
          onRetry={retry}
        />
      )}
    </main>
  );
}
