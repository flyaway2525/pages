import { useCallback, useEffect, useRef } from 'react';
import { ALL_SOUNDS, type Kana } from '../lib/toroParser';

// 単語ごとの音声（辞書の sound）を先読みしておき、押した瞬間に鳴らす。
// 音声が読み込めていない単語は Web Audio の合成音で代用する。
const FALLBACK_FREQ: Record<Kana, number> = { と: 880, ろ: 587 };

type AudioCtor = typeof AudioContext;

export function useToroSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef(new Map<string, AudioBuffer>());
  const currentRef = useRef<AudioScheduledSourceNode | null>(null);

  const getContext = useCallback(() => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) return null;
    ctxRef.current = new Ctor();
    return ctxRef.current;
  }, []);

  // ページを開いた時点で全音声を読み込む（最初のタップから声が出るように）
  useEffect(() => {
    const ctx = getContext();
    if (!ctx) return;
    let cancelled = false;
    ALL_SOUNDS.forEach(async (path) => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!res.ok) return;
        const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
        if (!cancelled) buffersRef.current.set(path, buffer);
      } catch {
        /* 読めなければ合成音 */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [getContext]);

  const play = useCallback(
    (sound: string | undefined, kana: Kana) => {
      const ctx = getContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();

      // 素早く連打したとき声が重ならないよう、前の音は止める
      try {
        currentRef.current?.stop();
      } catch {
        /* すでに止まっている */
      }

      const buffer = sound ? buffersRef.current.get(sound) : undefined;
      if (buffer) {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start();
        currentRef.current = src;
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
      currentRef.current = osc;
    },
    [getContext],
  );

  return play;
}
