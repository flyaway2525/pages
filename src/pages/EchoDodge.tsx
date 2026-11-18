import HomeIconLink from '../components/HomeIconLink';
import { ARENA_H, ARENA_W, useEchoDodgeGame } from '../hooks/useEchoDodgeGame';
import '../styles/pages/echo-dodge.css';

export default function EchoDodge() {
  const { canvasRef, hud, start, pointerHandlers } = useEchoDodgeGame();

  return (
    <main className="page feature-page echo-dodge-page">
      <div className="title-with-home">
        <HomeIconLink label="ホームに戻る" />
        <h1>残像ドッジ</h1>
      </div>

      <p className="ed-description">6秒前の自分が、敵になる。</p>

      <div className="ed-hud" aria-live="polite">
        <span>
          スコア <strong>{hud.score}</strong>
        </span>
        <span>
          時間 <strong>{hud.seconds}s</strong>
        </span>
        <span>
          残像 <strong>{hud.echoes}</strong>
        </span>
        <span className="ed-best">
          ベスト <strong>{hud.best}</strong>
        </span>
      </div>

      <div className="ed-stage">
        <canvas
          ref={canvasRef}
          width={ARENA_W}
          height={ARENA_H}
          className="ed-canvas"
          aria-label="残像ドッジのゲーム画面"
          {...pointerHandlers}
        />

        {hud.phase !== 'playing' && (
          <div className="ed-overlay">
            {hud.phase === 'over' ? (
              <>
                <p className="ed-overlay-title">過去の自分に捕まった</p>
                <p className="ed-overlay-score">
                  スコア {hud.score} / {hud.seconds}秒生存
                </p>
              </>
            ) : (
              <p className="ed-overlay-title">残像ドッジ</p>
            )}
            <button type="button" className="ed-start" onClick={start}>
              {hud.phase === 'over' ? 'もう一度' : 'スタート'}
            </button>
            <p className="ed-overlay-hint">Space / Enter でも開始</p>
          </div>
        )}
      </div>

      <section className="ed-rules">
        <h2>あそびかた</h2>
        <ul>
          <li>
            <b>移動</b>: 矢印キー / WASD、またはステージを押した（タッチした）場所へ移動
          </li>
          <li>
            <b className="ed-orb">黄色い玉</b>を取るとスコア加算。残像が多いほど1個の価値が上がる
          </li>
          <li>
            上のゲージが満タンになるたび、直前6秒間のあなたの動きが<b className="ed-echo">残像</b>
            になり、同じ軌跡をくり返し動き続ける（最大10体）
          </li>
          <li>出現直後の残像（点線）は1秒間だけ無害。実体化した残像に触れるとゲームオーバー</li>
          <li>じっとしていると、その場に残像が生まれる。動き続けよう</li>
        </ul>
      </section>
    </main>
  );
}
