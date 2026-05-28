import { useEffect, useMemo, useState } from 'react';
import HomeIconLink from '../components/HomeIconLink';
import '../styles/pages/quantum-gomoku.css';

type StoneState = 'black' | 'white' | null;
type TurnPlayer = Exclude<StoneState, null>;
type PieceOptionId = 'b90' | 'b70' | 'b30' | 'b10';

type PlacedStone = {
  pieceId: PieceOptionId;
  owner: TurnPlayer;
};

type PieceOption = {
  id: PieceOptionId;
  label: string;
  blackRate: number;
};

type LastUsedPieceByTurn = Record<TurnPlayer, PieceOptionId | null>;
type ObserveUsedByTurn = Record<TurnPlayer, number>;

type ObservationPopupState = {
  blackCount: number;
  whiteCount: number;
  observer: TurnPlayer;
};

type WinSegment = {
  color: TurnPlayer;
  start: { row: number; col: number };
  end: { row: number; col: number };
  length: number;
};

const BOARD_SIZE = 19;
const OBSERVE_LIMIT = 5;
const PIECE_OPTIONS: PieceOption[] = [
  { id: 'b90', label: '90%黒', blackRate: 0.9 },
  { id: 'b70', label: '70%黒', blackRate: 0.7 },
  { id: 'b30', label: '30%黒', blackRate: 0.3 },
  { id: 'b10', label: '10%黒', blackRate: 0.1 },
];

const DEFAULT_PIECE_BY_TURN: Record<TurnPlayer, PieceOptionId> = {
  black: 'b90',
  white: 'b10',
};

const PIECE_PRIORITY_BY_TURN: Record<TurnPlayer, PieceOptionId[]> = {
  black: ['b90', 'b70', 'b30', 'b10'],
  white: ['b10', 'b30', 'b70', 'b90'],
};

const createBoard = (): Array<PlacedStone | null> =>
  Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);

const resolveStoneColor = (blackRate: number): Exclude<StoneState, null> =>
  Math.random() < blackRate ? 'black' : 'white';

const choosePieceForTurn = (turn: TurnPlayer, lastUsed: LastUsedPieceByTurn): PieceOptionId => {
  const priority = PIECE_PRIORITY_BY_TURN[turn];
  const nextCandidate = priority.find((pieceId) => pieceId !== lastUsed[turn]);
  return nextCandidate ?? DEFAULT_PIECE_BY_TURN[turn];
};

const DIRECTIONS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 },
] as const;

const STAR_AXIS = [3, 9, 15] as const;
const STAR_POINT_SET = new Set<number>(
  STAR_AXIS.flatMap((row) => STAR_AXIS.map((col) => row * BOARD_SIZE + col))
);

const toBoardMatrix = (resolvedBoard: StoneState[]): StoneState[][] => {
  const matrix: StoneState[][] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const rowValues: StoneState[] = [];
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      rowValues.push(resolvedBoard[row * BOARD_SIZE + col] ?? null);
    }
    matrix.push(rowValues);
  }
  return matrix;
};

const detectWinSegment = (matrix: StoneState[][], color: TurnPlayer): WinSegment | null => {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (matrix[row][col] !== color) {
        continue;
      }

      for (const { dr, dc } of DIRECTIONS) {
        const prevRow = row - dr;
        const prevCol = col - dc;
        const hasPrevSame =
          prevRow >= 0 && prevRow < BOARD_SIZE && prevCol >= 0 && prevCol < BOARD_SIZE
            ? matrix[prevRow][prevCol] === color
            : false;
        if (hasPrevSame) {
          continue;
        }

        let runLength = 1;
        let nextRow = row + dr;
        let nextCol = col + dc;
        while (
          nextRow >= 0 &&
          nextRow < BOARD_SIZE &&
          nextCol >= 0 &&
          nextCol < BOARD_SIZE &&
          matrix[nextRow][nextCol] === color
        ) {
          runLength += 1;
          nextRow += dr;
          nextCol += dc;
        }

        if (runLength >= 5) {
          const lineLength = Math.min(runLength, 6);
          return {
            color,
            start: { row, col },
            end: { row: row + dr * (lineLength - 1), col: col + dc * (lineLength - 1) },
            length: lineLength,
          };
        }
      }
    }
  }

  return null;
};

export default function QuantumGomoku() {
  const [board, setBoard] = useState<Array<PlacedStone | null>>(() => createBoard());
  const [nextStone, setNextStone] = useState<TurnPlayer>('black');
  const [selectedPiece, setSelectedPiece] = useState<PieceOptionId>(DEFAULT_PIECE_BY_TURN.black);
  const [lastUsedPieceByTurn, setLastUsedPieceByTurn] = useState<LastUsedPieceByTurn>({
    black: null,
    white: null,
  });
  const [observeUsedByTurn, setObserveUsedByTurn] = useState<ObserveUsedByTurn>({
    black: 0,
    white: 0,
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pendingObserver, setPendingObserver] = useState<TurnPlayer | null>(null);
  const [winner, setWinner] = useState<TurnPlayer | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [winningSegments, setWinningSegments] = useState<WinSegment[]>([]);
  const [showWinningLines, setShowWinningLines] = useState(true);
  const [observationResolvedBoard, setObservationResolvedBoard] = useState<StoneState[] | null>(null);
  const [observationPopup, setObservationPopup] = useState<ObservationPopupState | null>(null);
  const [showReviewLabels, setShowReviewLabels] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const hasPlacedStone = useMemo(() => board.some((cell) => cell !== null), [board]);
  const isGameEnded = !!winner || isDraw;
  const isReviewLabelVisible = isGameEnded && showReviewLabels && !observationPopup;

  useEffect(() => {
    setSelectedPiece(choosePieceForTurn(nextStone, lastUsedPieceByTurn));
  }, [nextStone, lastUsedPieceByTurn]);

  const selectedPieceOption =
    PIECE_OPTIONS.find((option) => option.id === selectedPiece) ?? PIECE_OPTIONS[0];

  const placeStone = (index: number) => {
    if (winner || isDraw) {
      return;
    }
    if (lastUsedPieceByTurn[nextStone] === selectedPieceOption.id) {
      return;
    }

    if (board[index]) {
      return;
    }

    setBoard((previous) => {
      if (previous[index]) {
        return previous;
      }
      const next = [...previous];
      next[index] = {
        pieceId: selectedPieceOption.id,
        owner: nextStone,
      };
      return next;
    });
    setLastUsedPieceByTurn((previous) => ({
      ...previous,
      [nextStone]: selectedPieceOption.id,
    }));
    if (!winner) {
      setWinningSegments([]);
    }
    setShowWinningLines(true);
    setShowReviewLabels(false);
    setObservationResolvedBoard(null);
    setObservationPopup(null);
    setPendingObserver(observeUsedByTurn[nextStone] < OBSERVE_LIMIT ? nextStone : null);
    setNextStone((previous) => (previous === 'black' ? 'white' : 'black'));
    setHoverIndex(null);
  };

  const observeBoard = () => {
    if (winner || isDraw) {
      return;
    }
    if (!pendingObserver || !hasPlacedStone) {
      return;
    }
    if (observeUsedByTurn[pendingObserver] >= OBSERVE_LIMIT) {
      return;
    }

    const resolvedBoard = board.map((cell) => {
      if (!cell) {
        return null;
      }
      const option = PIECE_OPTIONS.find((piece) => piece.id === cell.pieceId);
      const blackRate = option?.blackRate ?? 0.5;
      return resolveStoneColor(blackRate);
    });

    const blackCount = resolvedBoard.reduce(
      (count, stone) => (stone === 'black' ? count + 1 : count),
      0
    );
    const whiteCount = resolvedBoard.reduce(
      (count, stone) => (stone === 'white' ? count + 1 : count),
      0
    );

    const matrix = toBoardMatrix(resolvedBoard);
    const blackWin = detectWinSegment(matrix, 'black');
    const whiteWin = detectWinSegment(matrix, 'white');
    const segments = [blackWin, whiteWin].filter((segment): segment is WinSegment => segment !== null);

    setWinningSegments(segments);
    if (blackWin && whiteWin) {
      setWinner(pendingObserver);
    } else if (blackWin) {
      setWinner('black');
    } else if (whiteWin) {
      setWinner('white');
    }

    const nextObserveUsedByTurn: ObserveUsedByTurn = {
      ...observeUsedByTurn,
      [pendingObserver]: observeUsedByTurn[pendingObserver] + 1,
    };
    setObserveUsedByTurn(nextObserveUsedByTurn);

    if (!blackWin && !whiteWin) {
      const bothExhausted =
        nextObserveUsedByTurn.black >= OBSERVE_LIMIT && nextObserveUsedByTurn.white >= OBSERVE_LIMIT;
      if (bothExhausted) {
        setIsDraw(true);
      }
    }

    setObservationResolvedBoard(resolvedBoard);
    setObservationPopup({ blackCount, whiteCount, observer: pendingObserver });
    setPendingObserver(null);
  };

  const closeObservationPopup = () => {
    setObservationPopup(null);
    if (!isGameEnded) {
      setObservationResolvedBoard(null);
      setWinningSegments([]);
    }
  };

  const resetBoard = () => {
    setBoard(createBoard());
    setNextStone('black');
    setSelectedPiece(DEFAULT_PIECE_BY_TURN.black);
    setLastUsedPieceByTurn({ black: null, white: null });
    setObserveUsedByTurn({ black: 0, white: 0 });
    setHoverIndex(null);
    setPendingObserver(null);
    setWinner(null);
    setIsDraw(false);
    setWinningSegments([]);
    setShowWinningLines(true);
    setShowReviewLabels(false);
    setShowHowTo(false);
    setShowResetConfirm(false);
    setObservationResolvedBoard(null);
    setObservationPopup(null);
  };

  return (
    <main className="page feature-page quantum-gomoku-page">
      <div className="title-with-home">
        <HomeIconLink label="ホームに戻る" />
        <h1>量子五目並べ</h1>
      </div>

      <p className="qg-description">観測するまで確定しない量子五目並べ</p>

      <div className="qg-toolbar">
        <span>
          観測残り 黒:{OBSERVE_LIMIT - observeUsedByTurn.black} / 白:{OBSERVE_LIMIT - observeUsedByTurn.white}
        </span>
        <span className={`qg-turn-indicator ${nextStone}`} aria-live="polite">
          現在の手番は{nextStone === 'black' ? '黒' : '白'}
        </span>
        <button
          className={`qg-observe-button${
            pendingObserver === 'black' ? ' black' : pendingObserver === 'white' ? ' white' : ''
          }`}
          type="button"
          onClick={observeBoard}
          disabled={
            !!winner ||
            isDraw ||
            !pendingObserver ||
            !hasPlacedStone ||
            (pendingObserver ? observeUsedByTurn[pendingObserver] >= OBSERVE_LIMIT : true)
          }
        >
          {pendingObserver === 'black'
            ? '先手(黒)の観測'
            : pendingObserver === 'white'
              ? '後手(白)の観測'
              : '観測'}
        </button>
        {winningSegments.length > 0 && (
          <button type="button" onClick={() => setShowWinningLines((previous) => !previous)}>
            {showWinningLines ? '線を隠す' : '線を表示'}
          </button>
        )}
        {isGameEnded && (
          <button type="button" onClick={() => setShowReviewLabels((previous) => !previous)}>
            {showReviewLabels ? '振り返り%表示を隠す' : '振り返り%表示を出す'}
          </button>
        )}
        <div className="qg-toolbar-actions">
          <button type="button" className="qg-howto-button" onClick={() => setShowHowTo(true)}>
            遊び方
          </button>
          <button type="button" className="qg-reset-toolbar-button" onClick={() => setShowResetConfirm(true)}>
            盤面をリセット
          </button>
        </div>
      </div>

      {winner && (
        <p className="qg-result" role="status">
          勝者: {winner === 'black' ? '黒' : '白'}
          {winningSegments.length === 2 ? '（両者五目成立のため観測者勝利）' : ''}
        </p>
      )}

      {isDraw && !winner && (
        <p className="qg-result" role="status">
          ドロー: 両プレイヤーが観測回数を使い切りました
        </p>
      )}

      <section className="qg-piece-picker" aria-label="配置するコマ選択">
        <div className="qg-piece-picker-row">
          <div className="qg-piece-picker-options" role="radiogroup" aria-label="コマの黒確率">
            {PIECE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selectedPiece === option.id}
                aria-disabled={lastUsedPieceByTurn[nextStone] === option.id}
                className={`qg-piece-option piece-${option.id}${selectedPiece === option.id ? ' active' : ''}`}
                disabled={lastUsedPieceByTurn[nextStone] === option.id || !!winner || isDraw}
                onClick={() => setSelectedPiece(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="qg-piece-picker-current">
            配置するコマを選択: <strong>{selectedPieceOption.label}</strong>
          </p>
        </div>
      </section>

      {observationPopup && (
        <div className="qg-observation-popup" role="dialog" aria-modal="true" aria-label="観測結果">
          <div className="qg-observation-popup-card">
            <p>観測結果</p>
            {winner && (
              <p className="qg-observation-popup-winner">勝者: {winner === 'black' ? '黒' : '白'}</p>
            )}
            <p>
              白 {observationPopup.whiteCount} 個 : 黒 {observationPopup.blackCount} 個
            </p>
            <button type="button" onClick={closeObservationPopup}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {showHowTo && (
        <div
          className="qg-howto-popup"
          role="dialog"
          aria-modal="true"
          aria-label="遊び方"
          onClick={() => setShowHowTo(false)}
        >
          <div className="qg-howto-popup-card" onClick={(event) => event.stopPropagation()}>
            <p className="qg-howto-popup-title">遊び方</p>
            <p>
              1. 手番のコマを1つ置く
              <br />
              2. その手番側の観測ボタンを押して、白黒を確定する
              <br />
              3. 5回以上の連なりができたら勝利、両者5回使い切りで未決着ならドロー
              <br />
              4. 観測ボタンを押すと、未観測コマが確率で白黒に確定します。五目（六目以上は六目）成立時はライン表示します。
            </p>
            <button type="button" onClick={() => setShowHowTo(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div
          className="qg-reset-popup"
          role="dialog"
          aria-modal="true"
          aria-label="リセット確認"
          onClick={() => setShowResetConfirm(false)}
        >
          <div className="qg-reset-popup-card" onClick={(event) => event.stopPropagation()}>
            <p className="qg-reset-popup-title">盤面をリセットしますか？</p>
            <div className="qg-reset-popup-actions">
              <button type="button" onClick={() => setShowResetConfirm(false)}>
                キャンセル
              </button>
              <button
                type="button"
                className="qg-reset-confirm-button"
                onClick={() => {
                  resetBoard();
                }}
              >
                リセットする
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="qg-play-layout">
        <section className="qg-board-panel" aria-label="量子五目並べ紹介">
          <div className="qg-board-grid-wrap">
            <div className="qg-board-grid" role="grid" aria-label="量子盤面 19x19">
              {board.map((cell, index) => {
                const row = Math.floor(index / BOARD_SIZE);
                const col = index % BOARD_SIZE;
                const isPreview = !cell && hoverIndex === index && !winner;
                const observedColor = observationResolvedBoard?.[index] ?? null;
                const isStarPoint = STAR_POINT_SET.has(index);

                return (
                  <button
                    key={index}
                    type="button"
                    className={`qg-intersection${isStarPoint ? ' star-point' : ''}${row === 0 ? ' edge-top' : ''}${
                      row === BOARD_SIZE - 1 ? ' edge-bottom' : ''
                    }${col === 0 ? ' edge-left' : ''}${col === BOARD_SIZE - 1 ? ' edge-right' : ''}`}
                    onClick={() => placeStone(index)}
                    onMouseEnter={() => setHoverIndex(index)}
                    onMouseLeave={() => setHoverIndex((previous) => (previous === index ? null : previous))}
                    onFocus={() => setHoverIndex(index)}
                    onBlur={() => setHoverIndex((previous) => (previous === index ? null : previous))}
                    disabled={!!cell || !!winner || isDraw}
                    aria-label={
                      cell
                        ? observedColor
                          ? `観測済み ${observedColor === 'black' ? '黒石' : '白石'} / ${cell.pieceId}`
                          : `未観測 / ${cell.pieceId}`
                        : '未配置セル'
                    }
                  >
                    {isStarPoint && <span className="qg-star-dot" aria-hidden="true" />}
                    {(cell || isPreview) && (
                      <span
                        className={`qg-stone ${
                          observedColor
                            ? `resolved ${observedColor} ${cell?.pieceId ?? ''}${isReviewLabelVisible ? ' review-labels' : ''}`
                            : cell
                              ? cell.pieceId
                              : `${selectedPiece} preview`
                        }${observedColor ? ' observed' : ''}`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {winningSegments.length > 0 && showWinningLines && (
              <svg className="qg-win-overlay" viewBox="0 0 19 19" preserveAspectRatio="none" aria-hidden="true">
                {winningSegments.map((segment) => {
                  const x1 = segment.start.col + 0.5;
                  const y1 = segment.start.row + 0.5;
                  const x2 = segment.end.col + 0.5;
                  const y2 = segment.end.row + 0.5;
                  const dx = x2 - x1;
                  const dy = y2 - y1;
                  const length = Math.hypot(dx, dy);
                  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
                  const radius = 0.64;

                  return (
                    <g
                      key={`${segment.color}-${segment.start.row}-${segment.start.col}-${segment.end.row}-${segment.end.col}`}
                      className={`qg-win-capsule ${segment.color}`}
                      transform={`translate(${x1} ${y1}) rotate(${angle})`}
                    >
                      <rect
                        x={-radius}
                        y={-radius}
                        width={length + radius * 2}
                        height={radius * 2}
                        rx={radius}
                        ry={radius}
                        className="qg-win-capsule-outline"
                      />
                    </g>
                  );
                })}
              </svg>
            )}

          </div>
        </section>
      </div>
    </main>
  );
}