// 「と」「ろ」だけで作られた文を、単語・とろとろ修飾・「と」接続に分解する。

export type Kana = 'と' | 'ろ';

export type WordVariant = {
  id: string;
  label: string;
  emoji: string;
  /** public/ 以下の画像パス。指定すると絵文字の代わりに表示する */
  image?: string;
  /** 同じ読みの中での出やすさ（省略時 1） */
  weight?: number;
  /** public/ 以下の音声パス。この単語ができた瞬間と、リザルトの全文再生で使う */
  sound?: string;
  /** リザルトでのこの画像の点数 */
  points: number;
};

type WordEntry = { reading: string; variants: WordVariant[] };

const S = 'sounds/toro/';

export const DICTIONARY: WordEntry[] = [
  {
    reading: 'と',
    variants: [
      { id: 'door', label: '戸', emoji: '🚪', sound: `${S}to1.wav`, points: 10 },
      { id: 'capital', label: '都', emoji: '🏯', sound: `${S}to2.wav`, points: 20 },
      { id: 'rabbit', label: '兎', emoji: '🐇', sound: `${S}to3.wav`, points: 20 },
    ],
  },
  {
    reading: 'ろ',
    variants: [
      { id: 'furnace', label: '炉', emoji: '🔥', sound: `${S}ro.wav`, points: 10 },
      { id: 'road', label: '路', emoji: '🛤️', sound: `${S}ro.wav`, points: 10 },
    ],
  },
  { reading: 'とと', variants: [{ id: 'fish', label: 'とと（おさかな）', emoji: '🐟', sound: `${S}toto.wav`, points: 30 }] },
  { reading: 'ととと', variants: [{ id: 'stumble', label: 'とととっ（よろける）', emoji: '💫', sound: `${S}tototo.wav`, points: 50 }] },
  { reading: 'とろ', variants: [
    { id: 'toro', label: 'トロ', emoji: '🍣', weight: 3, sound: `${S}toro.wav`, points: 40 },
    { id: 'pool', label: '瀞（川の淵）', emoji: '🏞️', sound: `${S}toro.wav`, points: 80 },
  ] },
  // 後ろに単語が続くときは「とろとろX」（修飾）として解釈される
  { reading: 'とろとろ', variants: [
    { id: 'sleepy', label: 'とろとろ（ねむい）', emoji: '😪', sound: `${S}torotoro.wav`, points: 60 },
    { id: 'stew', label: 'とろとろ（煮込み）', emoji: '🍲', sound: `${S}torotoro.wav`, points: 60 },
  ] },
  { reading: 'ろと', variants: [
    { id: 'loto-sword', label: 'ロトの剣', emoji: '⚔️', sound: `${S}roto1.wav`, points: 70 },
    { id: 'loto6', label: 'ロト6', emoji: '🎱', sound: `${S}roto2.wav`, points: 70 },
  ] },
  { reading: 'とろろ', variants: [{ id: 'tororo', label: 'とろろ', emoji: '🥣', sound: `${S}tororo.wav`, points: 60 }] },
  { reading: 'ととろ', variants: [{ id: 'totoro', label: 'ととろ', emoji: '🌳', sound: `${S}totoro.wav`, points: 100 }] },
];

/** 「とろとろ」で溶かすごとに加わる点数 */
export const MELT_POINTS = 50;
/** 「と」でつないだ部分の音声（全文再生用） */
const JOINER_SOUND = `${S}to1.wav`;
const MELT_SOUND = `${S}torotoro.wav`;

export const phrasePoints = (p: { word: WordVariant; melt: number }) => p.word.points + p.melt * MELT_POINTS;

/** 辞書に登録されている音声ファイル（重複なし） */
export const ALL_SOUNDS = [...new Set(DICTIONARY.flatMap((w) => w.variants.flatMap((v) => (v.sound ? [v.sound] : []))))];

const pickVariant = (variants: WordVariant[], h: number) => {
  const total = variants.reduce((sum, v) => sum + (v.weight ?? 1), 0);
  let r = h % total;
  for (const v of variants) {
    r -= v.weight ?? 1;
    if (r < 0) return v;
  }
  return variants[0];
};

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

type PhraseOption = { end: number; cost: number; phrase: Phrase };
/** 位置 i から文末までの最良の解釈（次の位置へのリンクで持つ） */
type Best = { cost: number; phrase: Phrase; joiner: 'と' | '' | null; next: number };

const hash = (n: number) => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

/**
 * 文を解析する。コストが最小の解釈を返す。
 * 文末から先頭へ向かって 1 回なめる動的計画法なので、長い文（数千文字）でも速い。
 * seed は同じ文の中で同音異義語の選択を安定させるために使う（入力のたびに戸→兎と変わらない）。
 */
export function parseSentence(text: string, seed: number): Sentence | null {
  const n = text.length;
  if (n === 0) return null;

  // best[i]: 位置 i から文末までを最小コストで解釈したときの先頭の単語
  const best: (Best | null)[] = new Array(n + 1).fill(null);
  for (let i = n - 1; i >= 0; i -= 1) {
    let b: Best | null = null;
    const consider = (cand: Best) => {
      if (!b || cand.cost < b.cost) b = cand;
    };
    const words: PhraseOption[] = [];
    for (const entry of DICTIONARY) {
      if (text.startsWith(entry.reading, i)) {
        const pick = pickVariant(entry.variants, hash(seed * 997 + i));
        words.push({ end: i + entry.reading.length, cost: COST_WORD, phrase: { word: pick, melt: 0 } });
      }
    }
    for (const p of words) {
      if (p.end === n) {
        consider({ cost: p.cost, phrase: p.phrase, joiner: null, next: -1 });
        continue;
      }
      const afterJoiner = text[p.end] === 'と' ? best[p.end + 1] : null;
      if (afterJoiner) consider({ cost: p.cost + afterJoiner.cost, phrase: p.phrase, joiner: 'と', next: p.end + 1 });
      const adjacent = best[p.end];
      if (adjacent) {
        consider({ cost: p.cost + COST_NO_JOINER + adjacent.cost, phrase: p.phrase, joiner: '', next: p.end });
      }
    }
    // 「とろとろ」+ 後ろの最良の解釈 → 後ろの先頭の単語を溶かす
    const melted = text.startsWith(MELT, i) ? best[i + MELT.length] : null;
    if (melted) {
      consider({ ...melted, cost: melted.cost + COST_MELT, phrase: { ...melted.phrase, melt: melted.phrase.melt + 1 } });
    }
    best[i] = b;
  }

  if (!best[0]) return null;
  const phrases: Phrase[] = [];
  const joiners: ('と' | '')[] = [];
  for (let cur: Best | null = best[0]; cur; cur = cur.next >= 0 ? best[cur.next] : null) {
    phrases.push(cur.phrase);
    if (cur.joiner !== null) joiners.push(cur.joiner);
  }
  return { phrases, joiners };
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

/** 文の合計点（各画像の点数の合計） */
export const sentenceScore = (s: Sentence) => s.phrases.reduce((sum, p) => sum + phrasePoints(p), 0);

/**
 * 全文をつなげて読み上げるための音声の並び。
 * phraseIndex はその音がどの画像に対応するか（「と」の接続は -1）。
 */
export const sentenceSoundSequence = (s: Sentence) => {
  const seq: { sound?: string; phraseIndex: number }[] = [];
  s.phrases.forEach((p, i) => {
    for (let m = 0; m < p.melt; m += 1) seq.push({ sound: MELT_SOUND, phraseIndex: i });
    seq.push({ sound: p.word.sound, phraseIndex: i });
    if (s.joiners[i] === 'と') seq.push({ sound: JOINER_SOUND, phraseIndex: -1 });
  });
  return seq;
};
