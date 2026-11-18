import { MELT_POINTS, phraseLabel, phrasePoints, type Sentence } from '../lib/toroParser';

export type ToroResultData = {
  text: string;
  sentence: Sentence;
  score: number;
  best: number;
  isNewBest: boolean;
};

type Props = {
  result: ToroResultData;
  /** 全文再生中に読み上げている画像の番号（-1 = なし） */
  activeIndex: number;
  playing: boolean;
  onReplay: () => void;
  onRetry: () => void;
};

export default function ToroResult({ result, activeIndex, playing, onReplay, onRetry }: Props) {
  const { sentence, score, best, isNewBest, text } = result;
  return (
    <div className="toro-result" role="dialog" aria-modal="true" aria-label="リザルト">
      <div className="toro-result-card">
        <p className="toro-result-heading">リザルト</p>
        <p className="toro-result-text">{text}</p>

        <ul className="toro-result-list">
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
          <strong>{score}</strong>
          <span>pt</span>
        </p>
        <p className="toro-result-best">{isNewBest ? '🎉 ベスト更新！' : `ベスト ${best} pt`}</p>

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
