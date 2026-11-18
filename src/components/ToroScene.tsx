import type { Phrase, Sentence } from '../lib/toroParser';
import { phraseLabel } from '../lib/toroParser';

function PhraseCard({ phrase }: { phrase: Phrase }) {
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
      <figcaption>{phraseLabel(phrase)}</figcaption>
    </figure>
  );
}

export default function ToroScene({ sentence }: { sentence: Sentence | null }) {
  if (!sentence) {
    return <p className="toro-scene-empty">「と」か「ろ」を押してみよう</p>;
  }
  const many = sentence.phrases.length >= 3;
  return (
    <div className={`toro-scene-row${many ? ' is-many' : ''}`}>
      {sentence.phrases.map((p, i) => (
        <div className="toro-scene-item" key={`${i}-${p.word.id}-${p.melt}`}>
          <PhraseCard phrase={p} />
          {i < sentence.joiners.length && (
            <span className={`toro-joiner${sentence.joiners[i] ? '' : ' is-loose'}`}>
              {sentence.joiners[i] || '・'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
