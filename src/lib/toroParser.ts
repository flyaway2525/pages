// 「と」「ろ」だけで作られた文を、単語・とろとろ修飾・「と」接続に分解する。

export type Kana = 'と' | 'ろ';

export type WordVariant = {
  id: string;
  label: string;
  emoji: string;
  /** public/ 以下の画像パス。指定すると絵文字の代わりに表示する */
  image?: string;
};

type WordEntry = { reading: string; variants: WordVariant[] };

export const DICTIONARY: WordEntry[] = [
  {
    reading: 'と',
    variants: [
      { id: 'door', label: '戸', emoji: '🚪' },
      { id: 'capital', label: '都', emoji: '🏯' },
      { id: 'rabbit', label: '兎', emoji: '🐇' },
    ],
  },
  {
    reading: 'ろ',
    variants: [
      { id: 'furnace', label: '炉', emoji: '🔥' },
      { id: 'road', label: '路', emoji: '🛤️' },
    ],
  },
  { reading: 'とと', variants: [{ id: 'fish', label: 'とと（おさかな）', emoji: '🐟' }] },
  { reading: 'とろ', variants: [{ id: 'toro', label: 'トロ', emoji: '🍣' }] },
  { reading: 'ろと', variants: [
    { id: 'loto-sword', label: 'ロトの剣', emoji: '⚔️' },
    { id: 'loto6', label: 'ロト6', emoji: '🎱' },
  ] },
  { reading: 'とろろ', variants: [{ id: 'tororo', label: 'とろろ', emoji: '🥣' }] },
  { reading: 'ととろ', variants: [{ id: 'totoro', label: 'ととろ', emoji: '🌳' }] },
];

export const MELT = 'とろとろ';

/** 図鑑に載せる項目（単語 + 文法） */
export const COLLECTION: { id: string; label: string; emoji: string; hint: string }[] = [
  ...DICTIONARY.flatMap((w) => w.variants.map((v) => ({ id: v.id, label: v.label, emoji: v.emoji, hint: w.reading }))),
  { id: 'melt', label: 'とろとろの○○', emoji: '🫠', hint: 'とろとろ＋○○' },
  { id: 'and', label: '○○と○○', emoji: '🤝', hint: '○○＋と＋○○' },
];

export type Phrase = { word: WordVariant; melt: number };
export type Sentence = { phrases: Phrase[]; joiners: ('と' | '')[] };

const COST_WORD = 10;
const COST_MELT = 5;
const COST_NO_JOINER = 15;

type PhraseOption = { end: number; cost: number; phrase: Phrase; start: number };
type SentenceOption = { cost: number; phrases: Phrase[]; joiners: ('と' | '')[] };

const hash = (n: number) => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

/**
 * 文を解析する。コストが最小の解釈を返す。
 * seed は同じ文の中で同音異義語の選択を安定させるために使う（入力のたびに戸→兎と変わらない）。
 */
export function parseSentence(text: string, seed: number): Sentence | null {
  const n = text.length;
  if (n === 0) return null;

  const phraseMemo = new Map<number, PhraseOption[]>();
  const phrasesAt = (i: number): PhraseOption[] => {
    const cached = phraseMemo.get(i);
    if (cached) return cached;
    const out: PhraseOption[] = [];
    for (const entry of DICTIONARY) {
      if (text.startsWith(entry.reading, i)) {
        const pick = entry.variants[hash(seed * 997 + i) % entry.variants.length];
        out.push({ start: i, end: i + entry.reading.length, cost: COST_WORD, phrase: { word: pick, melt: 0 } });
      }
    }
    if (text.startsWith(MELT, i)) {
      for (const inner of phrasesAt(i + MELT.length)) {
        out.push({ ...inner, start: i, cost: inner.cost + COST_MELT, phrase: { ...inner.phrase, melt: inner.phrase.melt + 1 } });
      }
    }
    phraseMemo.set(i, out);
    return out;
  };

  const sentenceMemo = new Map<number, SentenceOption | null>();
  const sentenceAt = (i: number): SentenceOption | null => {
    if (sentenceMemo.has(i)) return sentenceMemo.get(i) ?? null;
    let best: SentenceOption | null = null;
    const consider = (opt: SentenceOption) => {
      if (!best || opt.cost < best.cost) best = opt;
    };
    for (const p of phrasesAt(i)) {
      if (p.end === n) {
        consider({ cost: p.cost, phrases: [p.phrase], joiners: [] });
        continue;
      }
      if (text[p.end] === 'と') {
        const rest = sentenceAt(p.end + 1);
        if (rest) consider({ cost: p.cost + rest.cost, phrases: [p.phrase, ...rest.phrases], joiners: ['と', ...rest.joiners] });
      }
      const rest = sentenceAt(p.end);
      if (rest) {
        consider({ cost: p.cost + COST_NO_JOINER + rest.cost, phrases: [p.phrase, ...rest.phrases], joiners: ['', ...rest.joiners] });
      }
    }
    sentenceMemo.set(i, best);
    return best;
  };

  const best = sentenceAt(0);
  return best ? { phrases: best.phrases, joiners: best.joiners } : null;
}

export const phraseLabel = (p: Phrase) => `${'とろとろの'.repeat(p.melt)}${p.word.label}`;

export const sentenceLabel = (s: Sentence) =>
  s.phrases.map((p, i) => phraseLabel(p) + (i < s.joiners.length ? s.joiners[i] || '・' : '')).join('');

/** この文で見つけた図鑑 ID */
export const discoveredIds = (s: Sentence) => {
  const ids = s.phrases.map((p) => p.word.id);
  if (s.phrases.some((p) => p.melt > 0)) ids.push('melt');
  if (s.joiners.includes('と')) ids.push('and');
  return ids;
};
