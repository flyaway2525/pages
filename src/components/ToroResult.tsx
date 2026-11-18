import { useEffect, useRef } from 'react';
import { MELT_POINTS, phraseLabel, phrasePoints, type Sentence } from '../lib/toroParser';

export type ToroResultData = {
  text: string;
  sentence: Sentence;
  score: number;
  best: number;
  isNewBest: boolean;
};

export const SPEEDS = [1, 2, 4, 8];
const TEXT_PREVIEW = 60;

type Props = {
  result: ToroResultData;
  /** 全文再生中に読み上げている画像の番号（-1 = なし） */
  activeIndex: number;
  playing: boolean;
  speed: number;
  progress: { step: number; total: number };
  /** 再生速度を次の段階へ（×1 → ×2 → ×4 → ×8 → ×1） */
  onSpeed: () => void;
  onSkip: () => void;
  onReplay: () => void;
  onRetry: () => void;
};

export default function ToroResult(props: Props) {
  const { result, activeIndex, playing, speed, progress, onSpeed, onSkip, onReplay, onRetry } = props;
  const { sentence, score, best, isNewBest, text } = result;
  const listRef = useRef<HTMLUListElement | null>(null);

  // 読み上げ中の行が見えるように追いかける
  useEffect(() => {
    if (activeIndex < 0) return;
    const row = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: 'nearest', behavior: speed >= 4 ? 'auto' : 'smooth' });
  }, [activeIndex, speed]);

  const nextSpeed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  const shownText = text.length > TEXT_PREVIEW ? `…${text.slice(-TEXT_PREVIEW)}` : text;
  const percent = progress.total ? (progress.step / progress.total) * 100 : 0;

  return (
    <div className="toro-result" role="dialog" aria-modal="true" aria-label="リザルト">
      <div className="toro-result-card">
        <p className="toro-result-heading">リザルト</p>
        <p className="toro-result-text">{shownText}</p>
        <p className="toro-result-meta">
          {text.length.toLocaleString()}文字 ・ 画像 {sentence.phrases.length.toLocaleString()}枚
        </p>

        <div className="toro-result-player">
          <div className="toro-result-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
          <button
            type="button"
            className="toro-result-speed"
            onClick={onSpeed}
            aria-label={`再生速度 ${speed}倍（押すと${nextSpeed}倍）`}
          >
            ⏩ ×{speed}
          </button>
          <button type="button" className="toro-result-skip" onClick={onSkip} disabled={!playing}>
            ⏭ スキップ
          </button>
        </div>

        <ul className="toro-result-list" ref={listRef}>
          {sentence.phrases.map((p, i) => (
            <li key={`${i}-${p.word.id}`} className={i === activeIndex ? 'is-active' : undefined}>
              <span className={`toro-result-emoji melt-${Math.min(p.melt, 3)}`} aria-hidden="true">
                {p.word.image ? <img src={`${import.meta.env.BASE_URL}${p.word.image}`} alt="" /> : p.word.emoji}
              </span>
              <span className="toro-result-label">
                {phraseLabel(p)}
                {p.melt > 0 && (
                  <small>
                    {p.word.points} ＋ とろとろ {MELT_POINTS}×{p.melt}
                  </small>
                )}
              </span>
              <span className="toro-result-points">{phrasePoints(p)}</span>
            </li>
          ))}
        </ul>

        <p className="toro-result-total">
          <span>合計</span>
          <strong>{score.toLocaleString()}</strong>
          <span>pt</span>
        </p>
        <p className="toro-result-best">{isNewBest ? '🎉 ベスト更新！' : `ベスト ${best.toLocaleString()} pt`}</p>

        <div className="toro-result-actions">
          <button type="button" className="toro-result-replay" onClick={onReplay} disabled={playing}>
            {playing ? '再生中…' : 'もう一度聞く'}
          </button>
          <button type="button" className="toro-result-retry" onClick={onRetry}>
            もう一回あそぶ
          </button>
        </div>
      </div>
    </div>
  );
}
