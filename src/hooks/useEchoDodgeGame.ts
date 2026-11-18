import { useCallback, useEffect, useRef, useState } from 'react';

// 残像ドッジ: 一定周期ごとに「直前の自分の動き」が残像となってループ再生される。
// 残像に触れたらゲームオーバー。光の玉を集めてスコアを稼ぐ。

export const ARENA_W = 640;
export const ARENA_H = 480;

const TICK = 1 / 60;
const CYCLE_TICKS = 6 * 60; // 6 秒ごとに残像が生まれる
const WARMUP_TICKS = 60; // 出現直後 1 秒は当たり判定なし
const MAX_ECHOES = 10;
const PLAYER_R = 10;
const ECHO_R = 9;
const ORB_R = 8;
const PLAYER_SPEED = 230;
const BEST_KEY = 'echo-dodge-best';

type Vec = { x: number; y: number };
type Echo = { path: Vec[]; age: number };
export type Phase = 'ready' | 'playing' | 'over';

export type Hud = {
  phase: Phase;
  score: number;
  best: number;
  seconds: number;
  echoes: number;
};

type World = {
  player: Vec;
  recording: Vec[];
  echoes: Echo[];
  orb: Vec;
  tick: number;
  score: number;
  flash: number;
};

const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

const writeBest = (value: number) => {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* 保存できなくてもゲームは続行 */
  }
};

const randomOrb = (avoid: Vec): Vec => {
  for (let i = 0; i < 20; i += 1) {
    const p = { x: 40 + Math.random() * (ARENA_W - 80), y: 40 + Math.random() * (ARENA_H - 80) };
    if (Math.hypot(p.x - avoid.x, p.y - avoid.y) > 160) return p;
  }
  return { x: ARENA_W - avoid.x, y: ARENA_H - avoid.y };
};

const newWorld = (): World => {
  const player = { x: ARENA_W / 2, y: ARENA_H / 2 };
  return { player, recording: [], echoes: [], orb: randomOrb(player), tick: 0, score: 0, flash: 0 };
};

const echoPos = (e: Echo): Vec => e.path[e.age % e.path.length];

export function useEchoDodgeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World>(newWorld());
  const phaseRef = useRef<Phase>('ready');
  const keysRef = useRef(new Set<string>());
  const pointerRef = useRef<Vec | null>(null);
  const [hud, setHud] = useState<Hud>({ phase: 'ready', score: 0, best: readBest(), seconds: 0, echoes: 0 });

  const syncHud = useCallback(() => {
    const w = worldRef.current;
    setHud((prev) => {
      const next = {
        phase: phaseRef.current,
        score: w.score,
        best: prev.best,
        seconds: Math.floor(w.tick / 60),
        echoes: w.echoes.length,
      };
      if (next.phase === 'over' && next.score > prev.best) {
        next.best = next.score;
        writeBest(next.score);
      }
      const same =
        prev.phase === next.phase &&
        prev.score === next.score &&
        prev.best === next.best &&
        prev.seconds === next.seconds &&
        prev.echoes === next.echoes;
      return same ? prev : next;
    });
  }, []);

  const start = useCallback(() => {
    worldRef.current = newWorld();
    phaseRef.current = 'playing';
    syncHud();
  }, [syncHud]);

  const step = useCallback(() => {
    const w = worldRef.current;
    const keys = keysRef.current;
    let dx = 0;
    let dy = 0;
    if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
    const target = pointerRef.current;
    if (target && dx === 0 && dy === 0) {
      const tx = target.x - w.player.x;
      const ty = target.y - w.player.y;
      const dist = Math.hypot(tx, ty);
      if (dist > 2) {
        const k = Math.min(1, dist / (PLAYER_SPEED * TICK)) / dist;
        dx = tx * k;
        dy = ty * k;
      }
    } else if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }
    w.player.x = Math.min(ARENA_W - PLAYER_R, Math.max(PLAYER_R, w.player.x + dx * PLAYER_SPEED * TICK));
    w.player.y = Math.min(ARENA_H - PLAYER_R, Math.max(PLAYER_R, w.player.y + dy * PLAYER_SPEED * TICK));

    w.recording.push({ ...w.player });
    w.tick += 1;
    if (w.flash > 0) w.flash -= 1;

    if (w.recording.length >= CYCLE_TICKS) {
      w.echoes.push({ path: w.recording, age: 0 });
      if (w.echoes.length > MAX_ECHOES) w.echoes.shift();
      w.recording = [];
    }

    for (const e of w.echoes) {
      e.age += 1;
      const p = echoPos(e);
      if (e.age > WARMUP_TICKS && Math.hypot(p.x - w.player.x, p.y - w.player.y) < PLAYER_R + ECHO_R - 3) {
        phaseRef.current = 'over';
      }
    }

    if (Math.hypot(w.orb.x - w.player.x, w.orb.y - w.player.y) < PLAYER_R + ORB_R) {
      w.score += 1 + w.echoes.length;
      w.orb = randomOrb(w.player);
      w.flash = 12;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = worldRef.current;

    ctx.fillStyle = '#0d1020';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    ctx.strokeStyle = 'rgba(120, 140, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= ARENA_W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_H);
      ctx.stroke();
    }
    for (let y = 0; y <= ARENA_H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_W, y);
      ctx.stroke();
    }

    // 次の残像までのゲージ
    ctx.fillStyle = 'rgba(255, 90, 170, 0.6)';
    ctx.fillRect(0, 0, (w.recording.length / CYCLE_TICKS) * ARENA_W, 4);

    // 残像
    for (const e of w.echoes) {
      const armed = e.age > WARMUP_TICKS;
      for (let i = 1; i <= 8; i += 1) {
        const p = e.path[(e.age - i * 3 + e.path.length * 10) % e.path.length];
        ctx.fillStyle = `rgba(255, 80, 170, ${0.12 - i * 0.012})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, ECHO_R, 0, Math.PI * 2);
        ctx.fill();
      }
      const p = echoPos(e);
      ctx.beginPath();
      ctx.arc(p.x, p.y, ECHO_R, 0, Math.PI * 2);
      if (armed) {
        ctx.fillStyle = '#ff4fa8';
        ctx.shadowColor = '#ff4fa8';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 120, 190, 0.8)';
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 光の玉
    const pulse = 1 + Math.sin(w.tick / 8) * 0.15;
    ctx.fillStyle = '#ffd84d';
    ctx.shadowColor = '#ffd84d';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(w.orb.x, w.orb.y, ORB_R * pulse, 0, Math.PI * 2);
    ctx.fill();

    // プレイヤー
    ctx.fillStyle = w.flash > 0 ? '#ffffff' : '#4ff0ff';
    ctx.shadowColor = '#4ff0ff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(w.player.x, w.player.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (phaseRef.current === 'over') {
      ctx.fillStyle = 'rgba(13, 16, 32, 0.55)';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }
  }, []);

  // メインループ（固定ステップ）
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      acc += Math.min(0.25, (now - last) / 1000);
      last = now;
      while (acc >= TICK) {
        if (phaseRef.current === 'playing') step();
        acc -= TICK;
      }
      draw();
      syncHud();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw, step, syncHud]);

  // キーボード
  useEffect(() => {
    const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];
    const normalize = (key: string) => (key.length === 1 ? key.toLowerCase() : key);
    const onDown = (e: KeyboardEvent) => {
      const key = normalize(e.key);
      if (MOVE_KEYS.includes(key)) {
        keysRef.current.add(key);
        e.preventDefault();
      }
      if ((key === ' ' || key === 'Enter') && phaseRef.current !== 'playing') {
        e.preventDefault();
        start();
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(normalize(e.key));
    const onBlur = () => keysRef.current.clear();
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [start]);

  // ポインター（マウス / タッチ）: 押している間その位置へ移動
  const toArena = (e: React.PointerEvent<HTMLCanvasElement>): Vec => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * ARENA_W,
      y: ((e.clientY - rect.top) / rect.height) * ARENA_H,
    };
  };

  const pointerHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerRef.current = toArena(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (pointerRef.current) pointerRef.current = toArena(e);
    },
    onPointerUp: () => {
      pointerRef.current = null;
    },
    onPointerCancel: () => {
      pointerRef.current = null;
    },
  };

  return { canvasRef, hud, start, pointerHandlers };
}
