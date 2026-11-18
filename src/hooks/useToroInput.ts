import { useCallback, useEffect, useRef, useState } from 'react';
import type { Kana } from '../lib/toroParser';

export const CUT_MS = 1000;
const MAX_LENGTH = 16;

export type ToroInputState = {
  text: string;
  sentenceId: number;
  /** 1 秒入力がなく、文が確定した */
  closed: boolean;
  /** 入力ごとに増える（タイマー表示のアニメーション再始動用） */
  pressCount: number;
};

export function useToroInput(onClose: (text: string, sentenceId: number) => void) {
  const [state, setState] = useState<ToroInputState>({ text: '', sentenceId: 0, closed: true, pressCount: 0 });
  const timerRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const press = useCallback((kana: Kana) => {
    const prev = stateRef.current;
    const next: ToroInputState = prev.closed
      ? { text: kana, sentenceId: prev.sentenceId + 1, closed: false, pressCount: prev.pressCount + 1 }
      : {
          ...prev,
          text: prev.text.length >= MAX_LENGTH ? prev.text : prev.text + kana,
          pressCount: prev.pressCount + 1,
        };
    stateRef.current = next;
    setState(next);

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const cur = stateRef.current;
      const closed = { ...cur, closed: true };
      stateRef.current = closed;
      setState(closed);
      onCloseRef.current(cur.text, cur.sentenceId);
    }, CUT_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return { state, press };
}
