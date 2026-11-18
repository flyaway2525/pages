import { useCallback, useEffect, useRef } from 'react';
import { ALL_SOUNDS, type Kana } from '../lib/toroParser';

// 単語ごとの音声（辞書の sound）を先読みしておき、押した瞬間に鳴らす。
// 音声が読み込めていない単語は Web Audio の合成音で代用する。
const FALLBACK_FREQ: Record<Kana, number> = { と: 880, ろ: 587 };
const FALLBACK_SEC = 0.2;
/** 全文再生で音と音の間にあける秒数 */
const SEQUENCE_GAP_SEC = 0.04;

type AudioCtor = typeof AudioContext;

export type SequenceTiming = { phraseIndex: number; startMs: number; endMs: number };

export function useToroSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef(new Map<string, AudioBuffer>());
  const playingRef = useRef<AudioScheduledSourceNode[]>([]);

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

  const stop = useCallback(() => {
    for (const node of playingRef.current) {
      try {
        node.stop();
      } catch {
        /* すでに止まっている */
      }
    }
    playingRef.current = [];
  }, []);

  /** 指定時刻に 1 音を予約し、その長さ（秒）を返す */
  const schedule = useCallback((ctx: AudioContext, sound: string | undefined, kana: Kana, at: number) => {
    const buffer = sound ? buffersRef.current.get(sound) : undefined;
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(at);
      playingRef.current.push(src);
      return buffer.duration;
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kana === 'と' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(FALLBACK_FREQ[kana], at);
    osc.frequency.exponentialRampToValueAtTime(FALLBACK_FREQ[kana] * 0.7, at + 0.15);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.35, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + FALLBACK_SEC - 0.02);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + FALLBACK_SEC);
    playingRef.current.push(osc);
    return FALLBACK_SEC;
  }, []);

  const prepare = useCallback(() => {
    const ctx = getContext();
    if (ctx?.state === 'suspended') void ctx.resume();
    // 連打したとき声が重ならないよう、前の音は止める
    stop();
    return ctx;
  }, [getContext, stop]);

  /** ボタンを押したときの 1 音 */
  const play = useCallback(
    (sound: string | undefined, kana: Kana) => {
      const ctx = prepare();
      if (ctx) schedule(ctx, sound, kana, ctx.currentTime);
    },
    [prepare, schedule],
  );

  /** 全文をつなげて再生し、各音のタイミング（ミリ秒）を返す */
  const playSequence = useCallback(
    (items: { sound?: string; phraseIndex: number }[]): SequenceTiming[] => {
      const ctx = prepare();
      if (!ctx) return [];
      const start = ctx.currentTime + 0.05;
      let t = start;
      return items.map((item) => {
        const dur = schedule(ctx, item.sound, 'と', t);
        const timing = {
          phraseIndex: item.phraseIndex,
          startMs: (t - ctx.currentTime) * 1000,
          endMs: (t + dur - ctx.currentTime) * 1000,
        };
        t += dur + SEQUENCE_GAP_SEC;
        return timing;
      });
    },
    [prepare, schedule],
  );

  return { play, playSequence, stop };
}
