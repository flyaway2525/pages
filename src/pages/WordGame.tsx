import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const EASTER_EGGS: { word: string; message: string }[] = [
  { word: '伊沢拓司', message: '東大王！' },
  { word: '河村拓哉', message: '二極点河村' },
  { word: 'ふくらP', message: 'パズル王！' },
  { word: '鶴崎修功', message: 'IQ165の天才！' },
  { word: '須貝駿貴', message: 'ナイスガイの須貝です！' },
  { word: '山本祥彰', message: '漢字王！' },
  { word: '東問', message: 'お菓子大好き！' },
  { word: '東言', message: 'ゴンゴール！' },
];

type Player = 'red' | 'blue';
type CellOwner = Player | null;

type LogEntry = {
  turn: number;
  player: Player;
  action: 'word' | 'pass';
  word?: string;
  start?: string;
  end?: string;
  usedChars: string[];
  boardChars: string[];
  repaintedChars: string[];
  newlyPaintedChars: string[];
  message: string;
};

type GameSnapshot = {
  board: Record<string, CellOwner>;
  currentPlayer: Player;
  lastEndBaseChar: string | null;
  previousWord: string | null;
  isFinished: boolean;
  consecutivePasses: number;
  logs: LogEntry[];
};

const BOARD_ROWS = [
  ['わ', 'ら', 'や', 'ま', 'は', 'な', 'た', 'さ', 'か', 'あ'],
  ['を', 'り', '', 'み', 'ひ', 'に', 'ち', 'し', 'き', 'い'],
  ['ん', 'る', 'ゆ', 'む', 'ふ', 'ぬ', 'つ', 'す', 'く', 'う'],
  ['ー', 'れ', '', 'め', 'へ', 'ね', 'て', 'せ', 'け', 'え'],
  ['', 'ろ', 'よ', 'も', 'ほ', 'の', 'と', 'そ', 'こ', 'お'],
] as const;

const BOARD_KEYS = BOARD_ROWS.flat().filter(Boolean);
const BOARD_KEY_SET = new Set<string>(BOARD_KEYS);
const RULES_SEEN_KEY = 'word-game-rules-seen-v1';

const AIUEO_ORDER = [
  'あ',
  'い',
  'う',
  'え',
  'お',
  'か',
  'き',
  'く',
  'け',
  'こ',
  'さ',
  'し',
  'す',
  'せ',
  'そ',
  'た',
  'ち',
  'つ',
  'て',
  'と',
  'な',
  'に',
  'ぬ',
  'ね',
  'の',
  'は',
  'ひ',
  'ふ',
  'へ',
  'ほ',
  'ま',
  'み',
  'む',
  'め',
  'も',
  'や',
  'ゆ',
  'よ',
  'ら',
  'り',
  'る',
  'れ',
  'ろ',
  'わ',
  'を',
  'ん',
  'ー',
] as const;

const AIUEO_INDEX = new Map<string, number>(AIUEO_ORDER.map((char, index) => [char, index]));
const FIXED_START_OPTIONS = AIUEO_ORDER.filter((char) => BOARD_KEY_SET.has(char));

const SMALL_KANA_MAP: Record<string, string> = {
  ぁ: 'あ',
  ぃ: 'い',
  ぅ: 'う',
  ぇ: 'え',
  ぉ: 'お',
  ゃ: 'や',
  ゅ: 'ゆ',
  ょ: 'よ',
  っ: 'つ',
  ゎ: 'わ',
};

const DAKUTEN_TO_BASE: Record<string, string> = {
  が: 'か',
  ぎ: 'き',
  ぐ: 'く',
  げ: 'け',
  ご: 'こ',
  ざ: 'さ',
  じ: 'し',
  ず: 'す',
  ぜ: 'せ',
  ぞ: 'そ',
  だ: 'た',
  ぢ: 'ち',
  づ: 'つ',
  で: 'て',
  ど: 'と',
  ば: 'は',
  び: 'ひ',
  ぶ: 'ふ',
  べ: 'へ',
  ぼ: 'ほ',
  ぱ: 'は',
  ぴ: 'ひ',
  ぷ: 'ふ',
  ぺ: 'へ',
  ぽ: 'ほ',
  ゔ: 'う',
};

const createInitialBoard = (): Record<string, CellOwner> => {
  const initial: Record<string, CellOwner> = {};
  for (const key of BOARD_KEYS) {
    initial[key] = null;
  }
  return initial;
};

const toHiragana = (value: string): string =>
  value.replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));

const normalizeKana = (char: string): string => {
  const hira = toHiragana(char);
  return SMALL_KANA_MAP[hira] ?? hira;
};

const normalizeForBoard = (char: string): string => {
  const normalized = normalizeKana(char);
  return DAKUTEN_TO_BASE[normalized] ?? normalized;
};

const extractKanaChars = (word: string): string[] => {
  const chars = Array.from(toHiragana(word));
  return chars
    .map((char) => normalizeKana(char))
    .filter((char) => /^[ぁ-んー]$/.test(char));
};

const getNextPlayer = (player: Player): Player => (player === 'red' ? 'blue' : 'red');

export default function WordGame() {
  const [board, setBoard] = useState<Record<string, CellOwner>>(createInitialBoard);
  const [currentPlayer, setCurrentPlayer] = useState<Player>('red');
  const [word, setWord] = useState('');
  const [lastEndBaseChar, setLastEndBaseChar] = useState<string | null>(null);
  const [previousWord, setPreviousWord] = useState<string | null>(null);
  const [blockNEnding, setBlockNEnding] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [consecutivePasses, setConsecutivePasses] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [history, setHistory] = useState<GameSnapshot[]>([]);
  const [redoHistory, setRedoHistory] = useState<GameSnapshot[]>([]);
  const [logVisibility, setLogVisibility] = useState<'show' | 'hide'>('show');
  const [expandedLogTurns, setExpandedLogTurns] = useState<number[]>([]);
  const [replayTurn, setReplayTurn] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showTriviaModal, setShowTriviaModal] = useState(false);
  const [triviaMessage, setTriviaMessage] = useState('');
  const [hideRuleSettings, setHideRuleSettings] = useState(false);
  const [startCharMode, setStartCharMode] = useState<'random' | 'free' | 'fixed'>('fixed');
  const [fixedStartChar, setFixedStartChar] = useState('り');
  const [firstPlayer, setFirstPlayer] = useState<Player>('red');

  const totalCells = BOARD_KEYS.length;

  const score = useMemo(() => {
    let red = 0;
    let blue = 0;
    for (const value of Object.values(board)) {
      if (value === 'red') red += 1;
      if (value === 'blue') blue += 1;
    }
    return { red, blue };
  }, [board]);

  const replayBoard = useMemo(() => {
    if (replayTurn === null) {
      return null;
    }

    const replay = createInitialBoard();
    const ascending = [...logs].sort((a, b) => a.turn - b.turn);
    for (const entry of ascending) {
      if (entry.turn > replayTurn) {
        break;
      }
      if (entry.action === 'word') {
        for (const char of entry.boardChars) {
          replay[char] = entry.player;
        }
      }
    }
    return replay;
  }, [logs, replayTurn]);

  const boardForDisplay = replayBoard ?? board;
  const isReplaying = replayTurn !== null;

  const finishByBoard = (nextBoard: Record<string, CellOwner>) =>
    BOARD_KEYS.every((key) => nextBoard[key] !== null);

  const appendLog = (entry: Omit<LogEntry, 'turn'>) => {
    setLogs((prev) => [
      {
        turn: prev.length + 1,
        ...entry,
      },
      ...prev,
    ]);
  };

  const resetGame = () => {
    setBoard(createInitialBoard());
    setCurrentPlayer(firstPlayer);
    setWord('');
    setLastEndBaseChar(null);
    setPreviousWord(null);
    setIsFinished(false);
    setConsecutivePasses(0);
    setLogs([]);
    setHistory([]);
    setRedoHistory([]);
    setExpandedLogTurns([]);
    setReplayTurn(null);
    setError('');
    setNotice('');
    setShowResultModal(false);
    setGameStarted(false);
  };

  const createSnapshot = (): GameSnapshot => ({
    board: { ...board },
    currentPlayer,
    lastEndBaseChar,
    previousWord,
    isFinished,
    consecutivePasses,
    logs: [...logs],
  });

  const applySnapshot = (snapshot: GameSnapshot) => {
    setBoard(snapshot.board);
    setCurrentPlayer(snapshot.currentPlayer);
    setLastEndBaseChar(snapshot.lastEndBaseChar);
    setPreviousWord(snapshot.previousWord);
    setIsFinished(snapshot.isFinished);
    setConsecutivePasses(snapshot.consecutivePasses);
    setLogs(snapshot.logs);
  };

  const pushHistorySnapshot = () => {
    setHistory((prev) => [...prev, createSnapshot()]);
  };

  const undoLastMove = () => {
    if (history.length === 0) {
      return;
    }

    const previous = history[history.length - 1];
    setRedoHistory((prev) => [...prev, createSnapshot()]);
    setHistory((prev) => prev.slice(0, -1));
    applySnapshot(previous);
    setExpandedLogTurns([]);
    setReplayTurn(null);
    setError('');
    setNotice('1手巻き戻しました。');
  };

  const redoLastMove = () => {
    if (redoHistory.length === 0) {
      return;
    }

    const next = redoHistory[redoHistory.length - 1];
    setHistory((prev) => [...prev, createSnapshot()]);
    setRedoHistory((prev) => prev.slice(0, -1));
    applySnapshot(next);
    setExpandedLogTurns([]);
    setReplayTurn(null);
    setError('');
    setNotice('1手やり直しました。');
  };

  const toggleReplayTurn = (turn: number) => {
    setReplayTurn((prev) => (prev === turn ? null : turn));
  };

  const toggleLogDetail = (turn: number) => {
    setExpandedLogTurns((prev) =>
      prev.includes(turn) ? prev.filter((item) => item !== turn) : [...prev, turn],
    );
  };

  const startGame = () => {
    let initialStartChar: string | null = null;
    if (startCharMode === 'fixed') {
      initialStartChar = normalizeForBoard(fixedStartChar);
    }
    if (startCharMode === 'random') {
      const randomIndex = Math.floor(Math.random() * BOARD_KEYS.length);
      initialStartChar = BOARD_KEYS[randomIndex];
    }

    setCurrentPlayer(firstPlayer);
    setLastEndBaseChar(initialStartChar);
    setGameStarted(true);
    setHideRuleSettings(true);
    setError('');
    setNotice(initialStartChar ? `開始文字: ${initialStartChar}` : '');
  };

  const submitWord = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!gameStarted) {
      setNotice('ゲームを開始してください');
      return;
    }

    if (isFinished) {
      return;
    }

    const rawWord = word.trim();
    if (!rawWord) {
      setError('単語を入力してください。');
      return;
    }

    const easterEgg = EASTER_EGGS.find((e) => e.word === rawWord);
    if (easterEgg) {
      setTriviaMessage(easterEgg.message);
      setShowTriviaModal(true);
    }

    const kanaChars = extractKanaChars(rawWord);
    if (kanaChars.length === 0) {
      setError('ひらがな・カタカナを1文字以上含む単語を入力してください。');
      return;
    }

    const startChar = kanaChars[0];
    const endChar = kanaChars[kanaChars.length - 1];
    const startBase = normalizeForBoard(startChar);
    const endBase = normalizeForBoard(endChar);

    if (lastEndBaseChar && startBase !== lastEndBaseChar) {
      setError(`前の語尾「${lastEndBaseChar}」から始まる単語を入力してください。`);
      return;
    }

    if (blockNEnding && endBase === 'ん') {
      setError('ん終わりの単語は禁止設定です。');
      return;
    }

    const boardChars = Array.from(
      new Set(kanaChars.map((char) => normalizeForBoard(char)).filter((char) => BOARD_KEY_SET.has(char))),
    );

    if (boardChars.length === 0) {
      setError('五十音ボードの文字を1つ以上含む単語を入力してください。');
      return;
    }

    const hasAnyUnpainted = boardChars.some((char) => board[char] === null);
    if (!hasAnyUnpainted) {
      setError('未塗りマスを1つ以上含む単語のみ提出できます。');
      return;
    }

    const repaintedChars = boardChars.filter((char) => board[char] !== null);
    const newlyPaintedChars = boardChars.filter((char) => board[char] === null);

    const nextBoard = { ...board };
    for (const char of boardChars) {
      nextBoard[char] = currentPlayer;
    }

    pushHistorySnapshot();
    setRedoHistory([]);

    const nextPlayer = getNextPlayer(currentPlayer);
    const boardFilled = finishByBoard(nextBoard);

    setBoard(nextBoard);
    setCurrentPlayer(nextPlayer);
    setLastEndBaseChar(endBase);
    setPreviousWord(rawWord);
    setConsecutivePasses(0);
    setWord('');

    appendLog({
      player: currentPlayer,
      action: 'word',
      word: rawWord,
      start: startChar,
      end: endChar,
      usedChars: kanaChars,
      boardChars,
      repaintedChars,
      newlyPaintedChars,
      message: boardFilled ? '全マス使用でゲーム終了' : '有効手',
    });

    if (boardFilled) {
      setIsFinished(true);
      setShowResultModal(true);
    }
  };

  const passTurn = () => {
    if (!gameStarted) {
      setNotice('ゲームを開始してください');
      return;
    }

    if (isFinished) {
      return;
    }

    const nextPasses = consecutivePasses + 1;
    pushHistorySnapshot();
    setRedoHistory([]);
    appendLog({
      player: currentPlayer,
      action: 'pass',
      usedChars: [],
      boardChars: [],
      repaintedChars: [],
      newlyPaintedChars: [],
      message: 'パス',
    });

    if (nextPasses >= 2) {
      setConsecutivePasses(nextPasses);
      setIsFinished(true);
      setShowResultModal(true);
      return;
    }

    setConsecutivePasses(nextPasses);
    setCurrentPlayer(getNextPlayer(currentPlayer));
    setError('');
    setNotice('');
  };

  const winnerLabel = useMemo(() => {
    if (!isFinished) return '';
    if (score.red === score.blue) return '引き分け';
    return score.red > score.blue ? '赤の勝ち' : '青の勝ち';
  }, [isFinished, score.blue, score.red]);

  const winnerColorClass = useMemo(() => {
    if (!isFinished || score.red === score.blue) {
      return 'draw';
    }
    return score.red > score.blue ? 'red' : 'blue';
  }, [isFinished, score.blue, score.red]);

  useEffect(() => {
    if (!isFinished) {
      setShowResultModal(false);
    }
  }, [isFinished]);

  const logSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (logSectionRef.current) {
      logSectionRef.current.scrollTop = 0;
    }
  }, [logs, error, notice]);

  useEffect(() => {
    const seen = localStorage.getItem(RULES_SEEN_KEY);
    if (!seen) {
      setShowRulesModal(true);
    }
  }, []);

  const closeRulesModal = () => {
    setShowRulesModal(false);
    localStorage.setItem(RULES_SEEN_KEY, '1');
  };

  return (
    <main className="page game-page">
      <div className="game-heading">
        <h1>しりとりスプラトゥーン</h1>
        <p className="game-lead">
          50音表上で陣取りゲーム！しりとりをしながらより多くの文字を塗りつぶせ！
        </p>
      </div>

      <section className="game-layout">
        <div className="game-main">
          <section className="game-setup">
            <div className="game-start-panel">
              <div className="game-start-actions">
                {!gameStarted ? (
                  <button type="button" className="start-game-button" onClick={startGame}>
                    ゲーム開始
                  </button>
                ) : null}
                {gameStarted ? (
                  <button type="button" className="btn-reset" onClick={resetGame}>
                    リセット
                  </button>
                ) : null}
                <button type="button" className="btn-neutral" onClick={() => setShowRulesModal(true)}>
                  ルール詳細
                </button>
                <button
                  type="button"
                  className="btn-neutral"
                  onClick={() => setHideRuleSettings((prev) => !prev)}
                >
                  {hideRuleSettings ? 'ルール設定表示' : 'ルール設定非表示'}
                </button>
                {gameStarted ? (
                  <>
                    <button
                      type="button"
                      className="btn-back"
                      onClick={undoLastMove}
                      disabled={history.length === 0 || isReplaying}
                    >
                      戻る
                    </button>
                    <button
                      type="button"
                      className="btn-next"
                      onClick={redoLastMove}
                      disabled={redoHistory.length === 0 || isReplaying}
                    >
                      進む
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {!hideRuleSettings ? (
              <div className="game-rule-panel">
                <div className="game-rule-panel-head">
                  <h2>ルール設定</h2>
                </div>
                <div className="game-rule-fields">
                  <label>
                    ん終わり
                    <select
                      value={blockNEnding ? 'disabled' : 'allowed'}
                      disabled={gameStarted}
                      onChange={(event) => setBlockNEnding(event.target.value === 'disabled')}
                    >
                      <option value="allowed">有</option>
                      <option value="disabled">無</option>
                    </select>
                  </label>
                  <label>
                    開始文字
                    <select
                      value={startCharMode}
                      disabled={gameStarted}
                      onChange={(event) => setStartCharMode(event.target.value as 'random' | 'free' | 'fixed')}
                    >
                      <option value="random">ランダム</option>
                      <option value="free">制限なし</option>
                      <option value="fixed">固定文字</option>
                    </select>
                  </label>
                  {startCharMode === 'fixed' ? (
                    <select
                      aria-label="固定開始文字"
                      value={fixedStartChar}
                      disabled={gameStarted}
                      onChange={(event) => setFixedStartChar(event.target.value)}
                    >
                      {FIXED_START_OPTIONS.map((char) => (
                        <option key={char} value={char}>
                          {char}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <label>
                    先行
                    <select
                      value={firstPlayer}
                      disabled={gameStarted}
                      onChange={(event) => setFirstPlayer(event.target.value as Player)}
                    >
                      <option value="red">赤</option>
                      <option value="blue">青</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          <section className="score-board">
            <div className="score-chip red">赤: {score.red}</div>
            <div className="score-chip blue">青: {score.blue}</div>
            <div className="score-chip">残り: {totalCells - score.red - score.blue}</div>
          </section>

          <section className="gojuon-board" aria-label="五十音ボード">
            {BOARD_ROWS.map((row, rowIndex) =>
              row.map((char, colIndex) => {
                if (!char) {
                  return <div key={`empty-${rowIndex}-${colIndex}`} className="cell empty" />;
                }
                const owner = boardForDisplay[char];
                return (
                  <div key={char} className={`cell ${owner ?? 'none'}`}>
                    {char}
                  </div>
                );
              }),
            )}
          </section>

          <section className="game-action-panel">
            <div className="game-turn-info">
              <div>
                <strong>現在ターン:</strong>{' '}
                <span className={`turn-player-label ${currentPlayer === 'red' ? 'red' : 'blue'}`}>
                  {currentPlayer === 'red' ? '赤' : '青'}
                </span>
              </div>
              <div>
                <strong>前の単語:</strong> {previousWord ?? '---'}
              </div>
              <div>
                <strong>次の頭文字:</strong>{' '}
                <span className="next-char-badge">{lastEndBaseChar ?? '自由'}</span>
              </div>
            </div>

            <form className="game-form" onSubmit={submitWord}>
              <input
                type="text"
                value={word}
                disabled={!gameStarted || isFinished || isReplaying}
                onChange={(event) => {
                  setWord(event.target.value);
                  setNotice('');
                }}
                placeholder="単語を入力"
              />
              <button
                type="submit"
                className={gameStarted ? 'btn-primary' : 'btn-neutral'}
                disabled={!gameStarted || isFinished || isReplaying}
              >
                提出
              </button>
              <button
                type="button"
                className={gameStarted ? 'btn-pass' : 'btn-neutral'}
                onClick={passTurn}
                disabled={!gameStarted || isFinished || isReplaying}
              >
                パス
              </button>
            </form>
          </section>

          {isReplaying ? (
            <div className="replay-banner">
              <span>{replayTurn}手目終了時点の盤面を表示中</span>
              <button type="button" onClick={() => setReplayTurn(null)}>
                現在盤面に戻る
              </button>
            </div>
          ) : null}
        </div>

        <section className="game-logs game-side" ref={logSectionRef}>
        <h2>入力ログ</h2>
        <div className="game-log-messages">
          {error ? <p className="game-error">{error}</p> : null}
          {notice ? <p className="game-notice">{notice}</p> : null}
          {isFinished ? <p className="game-finish">ゲーム終了: {winnerLabel}</p> : null}
        </div>
        <div className="log-tabs" role="tablist" aria-label="ログ表示切替">
          <button
            type="button"
            role="tab"
            aria-selected={logVisibility === 'show'}
            className={logVisibility === 'show' ? 'active' : ''}
            onClick={() => setLogVisibility('show')}
          >
            表示
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={logVisibility === 'hide'}
            className={logVisibility === 'hide' ? 'active' : ''}
            onClick={() => setLogVisibility('hide')}
          >
            非表示
          </button>
        </div>

        {logVisibility === 'hide' ? <p>ログは非表示です。</p> : null}
        {logVisibility === 'show' && logs.length === 0 ? <p>まだログはありません。</p> : null}
        {logVisibility === 'show' ? (
          <ul>
            {logs.map((entry) => {
              const expanded = expandedLogTurns.includes(entry.turn);
              return (
                <li key={entry.turn}>
                  <div className="log-row">
                    <button
                      type="button"
                      className={`log-main-row ${replayTurn === entry.turn ? 'active' : ''}`}
                      onClick={() => toggleReplayTurn(entry.turn)}
                    >
                      <strong className={`log-player-label ${entry.player === 'red' ? 'red' : 'blue'}`}>
                        {entry.turn}. {entry.player === 'red' ? '赤' : '青'}
                      </strong>{' '}
                      {entry.action === 'pass' ? 'パス' : `「${entry.word}」`}
                    </button>

                    <button
                      type="button"
                      className="log-detail-toggle"
                      onClick={() => toggleLogDetail(entry.turn)}
                    >
                      {expanded ? '詳細を閉じる' : '詳細を表示'}
                    </button>
                  </div>

                  {expanded ? (
                    <div className="log-details">
                      {entry.action === 'word' ? (
                        <>
                          <div>
                            始端/終端: {entry.start} / {entry.end}
                          </div>
                          <div>使用文字: {entry.usedChars.join('、')}</div>
                          <div>ボード文字: {entry.boardChars.join('、')}</div>
                          <div>
                            新規: {entry.newlyPaintedChars.length ? entry.newlyPaintedChars.join('、') : 'なし'}
                          </div>
                          <div>
                            上書き: {entry.repaintedChars.length ? entry.repaintedChars.join('、') : 'なし'}
                          </div>
                        </>
                      ) : (
                        <div>このターンはパスです。</div>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        </section>
      </section>

      <div className="game-divider" aria-hidden="true" />

      <section className="game-memo" aria-label="インスピレーションとクレジット">
        <h2>Inspiration / Credit</h2>
        <p className="game-memo-item">
          <span className="game-memo-label">Idea</span>
          <span>QuizKnock 動画</span>
        </p>
        <p className="game-memo-item">
          <span className="game-memo-label">Title</span>
          <span>【塗られたら塗り返せ】しりとりで使った文字を自分の陣地にできるゲームで大白熱【しりとりスプラトゥーン】</span>
        </p>
        <p className="game-memo-item">
          <span className="game-memo-label">Source</span>
          <a href="https://www.youtube.com/watch?v=U6RiWWDAmsM" target="_blank" rel="noreferrer">
            https://www.youtube.com/watch?v=U6RiWWDAmsM
          </a>
        </p>
        <p className="game-memo-item">
          <span className="game-memo-label">Built with</span>
          <span>GitHub Copilot</span>
        </p>
      </section>

      <Link to="/" className="back-link">
        ← Homeに戻る
      </Link>

      {showRulesModal ? (
        <div className="rules-modal-backdrop" role="dialog" aria-modal="true" aria-label="ルール説明">
          <div className="rules-modal">
            <h2>ルール</h2>
            <ul>
              <li>2人で交互に単語を入力します。</li>
              <li>しりとり接続は濁音と清音を相互に許可します。</li>
              <li>単語には未塗りマスを1つ以上含む必要があります。</li>
              <li>使用したボード文字はすべて現在プレイヤー色で上書きされます。</li>
              <li>ん終わり禁止は開始前に切り替えできます。</li>
              <li>全マス使用または両者連続パスで終了し、塗りマス数が多い側の勝ちです。</li>
            </ul>
            <button type="button" onClick={closeRulesModal}>
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      {showResultModal ? (
        <div className="result-modal-backdrop" role="dialog" aria-modal="true" aria-label="リザルト">
          <div className="result-modal">
            <h2>リザルト</h2>
            <p className={`result-winner ${winnerColorClass}`}>{winnerLabel}</p>
            <div className="result-stats">
              <div>
                <span>赤チーム</span>
                <strong>{score.red} マス</strong>
              </div>
              <div>
                <span>青チーム</span>
                <strong>{score.blue} マス</strong>
              </div>
              <div>
                <span>総マス数</span>
                <strong>{totalCells} マス</strong>
              </div>
              <div>
                <span>マス差</span>
                <strong>{Math.abs(score.red - score.blue)} マス</strong>
              </div>
            </div>
            <button type="button" onClick={() => setShowResultModal(false)}>
              閉じる
            </button>
          </div>
        </div>
      ) : null}

      {showTriviaModal ? (
        <div className="trivia-modal-backdrop" role="dialog" aria-modal="true" aria-label="小ネタ">
          <div className="trivia-modal">
            <p>{triviaMessage}</p>
            <button type="button" onClick={() => setShowTriviaModal(false)}>
              閉じる
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}