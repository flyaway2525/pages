import { useCallback, useRef } from 'react';
import type { Kana } from '../lib/toroParser';

// 音源は public/sounds/toro/to.mp3 と ro.mp3 に置くと使われる。
// 見つからない場合は Web Audio で合成した短い音を鳴らす。
const SOUND_FILES: Record<Kana, string> = {
  と: 'sounds/toro/to.mp3',
  ろ: 'sounds/toro/ro.mp3',
};

const FALLBACK_FREQ: Record<Kana, number> = { と: 880, ろ: 587 };

export function useToroSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Partial<Record<Kana, AudioBuffer>>>({});

  const ensureContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    ctxRef.current = ctx;
    (Object.keys(SOUND_FILES) as Kana[]).forEach(async (kana) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${SOUND_FILES[kana]}`);
        if (!res.ok) return;
        buffersRef.current[kana] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        /* 音源なし → 合成音で代用 */
      }
    });
    return ctx;
  }, []);

  const play = useCallback(
    (kana: Kana) => {
      const ctx = ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();
      const buffer = buffersRef.current[kana];
      if (buffer) {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start();
        return;
      }
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kana === 'と' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(FALLBACK_FREQ[kana], t);
      osc.frequency.exponentialRampToValueAtTime(FALLBACK_FREQ[kana] * 0.7, t + 0.15);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    },
    [ensureContext],
  );

  return play;
}
