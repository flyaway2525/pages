// 入力した文字列。新しい文字が右から入り、古い文字ほど左奥へ流れて小さく薄くなる。

type Props = { text: string; closed: boolean };

const BASE_REM = 2.6;
const STEP_SCALE = 0.09;
const MIN_SCALE = 0.3;

export default function ToroTyped({ text, closed }: Props) {
  const chars = [...text];
  return (
    <div className={`toro-typed-stage${closed ? ' is-closed' : ''}`} aria-label={text} role="text">
      <div className="toro-typed-track">
        {chars.map((ch, i) => {
          const depth = chars.length - 1 - i; // 0 = いちばん新しい文字
          const scale = Math.max(MIN_SCALE, 1 - depth * STEP_SCALE);
          return (
            <span
              key={i}
              className={`toro-typed-char${depth === 0 ? ' is-new' : ''}`}
              style={{ fontSize: `${BASE_REM * scale}rem`, opacity: Math.max(0.15, 1 - depth * 0.08) }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}
