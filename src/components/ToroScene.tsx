import type { CSSProperties } from 'react';
import type { Phrase, Sentence } from '../lib/toroParser';
import { phraseLabel } from '../lib/toroParser';

// 新しい画像は右手前、古い画像ほど左上の消失点へ向かって小さくなる（遠近法）。
// 一定の大きさ以下にはならないので消えない。奥に溜まった分は重なって山になる。

const NEAR = { x: 70, y: 56 }; // いちばん新しい画像の中心（%）
const VANISH = { x: 10, y: 24 }; // 消失点（%）
const DEPTH_K = 1.05; // 大きいほど早く奥へ行く
const MIN_SCALE = 0.09;
/** 描画する最大数。これより古いものは消失点の山に埋もれて見えないため省略する */
const MAX_RENDER = 160;

const perspective = (depth: number) => 1 / (1 + depth * DEPTH_K);

const place = (depth: number) => {
  const f = perspective(depth);
  return {
    x: VANISH.x + (NEAR.x - VANISH.x) * f,
    y: VANISH.y + (NEAR.y - VANISH.y) * f,
    scale: Math.max(MIN_SCALE, f),
  };
};

const itemStyle = (x: number, y: number, scale: number, depth: number): CSSProperties => ({
  left: `${x}%`,
  top: `${y}%`,
  transform: `translate(-50%, -50%) scale(${scale})`,
  zIndex: MAX_RENDER * 2 - depth * 2,
});

function PhraseCard({ phrase, showCaption }: { phrase: Phrase; showCaption: boolean }) {
  const melt = Math.min(phrase.melt, 3);
  const { word } = phrase;
  return (
    <figure className={`toro-card melt-${melt}`}>
      <div className="toro-card-art">
        {word.image ? (
          <img src={`${import.meta.env.BASE_URL}${word.image}`} alt={word.label} />
        ) : (
          <span className="toro-card-emoji" aria-hidden="true">
            {word.emoji}
          </span>
        )}
        {melt > 0 && <span className="toro-drip" aria-hidden="true" />}
      </div>
      <figcaption className={showCaption ? undefined : 'is-hidden'}>{phraseLabel(phrase)}</figcaption>
    </figure>
  );
}

export default function ToroScene({ sentence }: { sentence: Sentence | null }) {
  if (!sentence) {
    return <p className="toro-scene-empty">「と」か「ろ」を押してみよう</p>;
  }
  const total = sentence.phrases.length;
  const first = Math.max(0, total - MAX_RENDER);

  return (
    <div className="toro-depth">
      {sentence.phrases.slice(first).map((p, k) => {
        const index = first + k;
        const depth = total - 1 - index;
        const here = place(depth);
        const joiner = sentence.joiners[index];
        // 「と」はこの画像と、ひとつ新しい画像の間に置く
        const nextPlace = depth > 0 ? place(depth - 1) : null;
        return [
          <div key={`p${index}`} className="toro-depth-item" style={itemStyle(here.x, here.y, here.scale, depth)}>
            <PhraseCard phrase={p} showCaption={here.scale > 0.3} />
          </div>,
          nextPlace && joiner !== undefined && (
            <span
              key={`j${index}`}
              className={`toro-depth-item toro-joiner${joiner ? '' : ' is-loose'}`}
              style={itemStyle(
                (here.x + nextPlace.x) / 2,
                (here.y + nextPlace.y) / 2 - 4 * here.scale,
                (here.scale + nextPlace.scale) / 2,
                depth - 0.5,
              )}
            >
              {joiner || '・'}
            </span>
          ),
        ];
      })}
    </div>
  );
}
