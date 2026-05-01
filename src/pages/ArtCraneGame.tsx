import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import HomeIconLink from '../components/HomeIconLink';
import '../styles/pages/art-crane-game.css';

// ======================== Types ========================

type GameStep = 'select' | 'play';

type GamePhase = 'play' | 'result';

type MoveDirection = 'right' | 'up';

type ControlPhase =
  | 'await-right-press'
  | 'right-holding'
  | 'await-up-press'
  | 'up-holding'
  | 'completed';

interface Point {
  x: number;
  y: number;
}

interface PaintingQuestion {
  id: string;
  imageUrl: string;
  aspectRatio: number;
  question: string;
  targetPoint: Point;
}

const SAMPLE_BUTTON_LABELS = [
  '例題1 : フェルメール',
  '例題2 : 葛飾北斎',
  '例題3 : ゴッホ',
  '例題4 : モネ',
];

const buildArtCraneImagePath = (fileName: string) => `${import.meta.env.BASE_URL}images/art-crane/${fileName}`;

// ======================== Sample Data ========================

const SAMPLE_QUESTIONS: PaintingQuestion[] = [
  {
    id: 'sample-4',
    imageUrl: buildArtCraneImagePath('GirlWithAPearlEarring.jpg'),
    aspectRatio: 330 / 388,
    question: 'フェルメールの『真珠の耳飾りの少女』の真珠はどこ？',
    targetPoint: { x: 0.63, y: 0.55 },
  },
  {
    id: 'sample-1',
    imageUrl: buildArtCraneImagePath('TheGreatWaveOffKanagawa.jpg'),
    aspectRatio: 1280 / 883,
    question: '葛飾北斎の『富嶽三十六景 神奈川沖浪裏』の「富嶽」はどこ？',
    targetPoint: { x: 0.64, y: 0.66 },
  },
  {
    id: 'sample-2',
    imageUrl: buildArtCraneImagePath('StarryNight.jpg'),
    aspectRatio: 330 / 261,
    question: '『星月夜』の月はどこ？',
    targetPoint: { x: 0.90, y: 0.18 },
  },
  {
    id: 'sample-3',
    imageUrl: buildArtCraneImagePath('ImpressionHinode.jpg'),
    aspectRatio: 1280 / 993,
    question: 'モネ『印象・日の出』の「日」はどこ？',
    targetPoint: { x: 0.61, y: 0.31 },
  },
];

// ======================== Constants ========================

const HOLD_MOVE_INTERVAL_MS = 60;
const HOLD_MOVE_STEP = 0.03;
const RESULT_ANIMATION_MS = 2000;
const RESULT_POPUP_DELAY_MS = 2000;
const MAX_SCORE = 10000;
const SCORE_RADIUS_PX = 200;
const CUSTOM_QUESTIONS_STORAGE_KEY = 'art-crane-custom-questions';

// ======================== Main Component ========================

export default function ArtCraneGame() {
  // Game State
  const [step, setStep] = useState<GameStep>('select');
  const [phase, setPhase] = useState<GamePhase>('play');
  const [questions, setQuestions] = useState<PaintingQuestion[]>(SAMPLE_QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [cranePosition, setCranePosition] = useState<Point>({ x: 0, y: 1 });
  const [controlPhase, setControlPhase] = useState<ControlPhase>('await-right-press');
  const [score, setScore] = useState<number | null>(null);
  const [revealProgress, setRevealProgress] = useState(0);
  const [resultPopupReady, setResultPopupReady] = useState(false);
  const [resultPopupVisible, setResultPopupVisible] = useState(true);
  const [debugClickPoint, setDebugClickPoint] = useState<Point | null>(null);

  // Setup Phase State
  const [setupImage, setSetupImage] = useState<string>('');
  const [setupImageAspectRatio, setSetupImageAspectRatio] = useState(1);
  const [setupQuestion, setSetupQuestion] = useState('');
  const [setupTargetPoint, setSetupTargetPoint] = useState<Point | null>(null);
  const [setupErrors, setSetupErrors] = useState<string[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<PaintingQuestion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const setupCanvasRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const moveIntervalRef = useRef<number | null>(null);

  const currentQuestion = questions[currentQuestionIndex];

  const saveCustomQuestions = (nextQuestions: PaintingQuestion[]) => {
    setSavedQuestions(nextQuestions);
    window.localStorage.setItem(CUSTOM_QUESTIONS_STORAGE_KEY, JSON.stringify(nextQuestions));
  };

  // ======================== Setup Phase Handlers ========================

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setSetupImage(dataUrl);
        setSetupImageAspectRatio(img.width / img.height);
        setSetupTargetPoint(null);
        setSetupErrors([]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!setupCanvasRef.current) return;

    const rect = setupCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setSetupTargetPoint({
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
  };

  const handleStartSetupGame = () => {
    const errors: string[] = [];

    if (!setupImage) errors.push('画像をアップロードしてください');
    if (!setupQuestion.trim()) errors.push('問題文を入力してください');
    if (!setupTargetPoint) errors.push('ターゲット位置をクリックして指定してください');

    if (errors.length > 0) {
      setSetupErrors(errors);
      return;
    }

    if (!setupTargetPoint) return;

    const newQuestion: PaintingQuestion = {
      id: `custom-${Date.now()}`,
      imageUrl: setupImage,
      aspectRatio: setupImageAspectRatio,
      question: setupQuestion,
      targetPoint: setupTargetPoint,
    };

    saveCustomQuestions([newQuestion, ...savedQuestions]);
    handleStartGame([newQuestion], 0);
    resetSetup();
  };

  const handlePlaySavedQuestion = (question: PaintingQuestion) => {
    handleStartGame([question], 0);
  };

  const handleDeleteSavedQuestion = (questionId: string) => {
    saveCustomQuestions(savedQuestions.filter((question) => question.id !== questionId));
  };

  const resetSetup = () => {
    setSetupImage('');
    setSetupImageAspectRatio(1);
    setSetupQuestion('');
    setSetupTargetPoint(null);
    setSetupErrors([]);
  };

  // ======================== Helpers ========================

  const calculateScore = (cranePos: Point, targetPos: Point, canvasWidth: number): number => {
    const cranePixelX = cranePos.x * canvasWidth;
    const cranePixelY = cranePos.y * (canvasWidth / currentQuestion.aspectRatio);
    const targetPixelX = targetPos.x * canvasWidth;
    const targetPixelY = targetPos.y * (canvasWidth / currentQuestion.aspectRatio);

    const distance = Math.sqrt(
      (cranePixelX - targetPixelX) ** 2 + (cranePixelY - targetPixelY) ** 2,
    );

    if (distance <= 0) return MAX_SCORE;
    const maxDistance = SCORE_RADIUS_PX;
    const ratio = Math.min(distance / maxDistance, 1);
    return Math.max(Math.round(MAX_SCORE * (1 - ratio ** 0.5)), 0);
  };

  // ======================== Event Handlers ========================

  const moveCrane = (direction: MoveDirection) => {
    if (direction === 'right') {
      setCranePosition((prev) => ({ ...prev, x: Math.min(prev.x + HOLD_MOVE_STEP, 1) }));
      return;
    }

    setCranePosition((prev) => ({ ...prev, y: Math.max(prev.y - HOLD_MOVE_STEP, 0) }));
  };

  const stopMoveInterval = () => {
    if (moveIntervalRef.current === null) return;
    window.clearInterval(moveIntervalRef.current);
    moveIntervalRef.current = null;
  };

  const startLongPress = (direction: MoveDirection) => {
    const canStartRight = direction === 'right' && controlPhase === 'await-right-press';
    const canStartUp = direction === 'up' && controlPhase === 'await-up-press';
    if (!canStartRight && !canStartUp) return;

    stopMoveInterval();
    setControlPhase(direction === 'right' ? 'right-holding' : 'up-holding');

    moveCrane(direction);
    moveIntervalRef.current = window.setInterval(() => {
      moveCrane(direction);
    }, HOLD_MOVE_INTERVAL_MS);
  };

  const endLongPress = (direction: MoveDirection) => {
    if (direction === 'right' && controlPhase === 'right-holding') {
      stopMoveInterval();
      setControlPhase('await-up-press');
      return;
    }

    if (direction === 'up' && controlPhase === 'up-holding') {
      stopMoveInterval();
      setControlPhase('completed');
      return;
    }

    stopMoveInterval();
  };

  const submitAnswer = () => {
    if (!canvasRef.current) return;
    const width = canvasRef.current.offsetWidth;
    const calculatedScore = calculateScore(cranePosition, currentQuestion.targetPoint, width);
    setScore(calculatedScore);
    setResultPopupReady(false);
    setResultPopupVisible(true);
    setDebugClickPoint(null);
    setPhase('result');
    setRevealProgress(0);
  };

  const handleRetry = () => {
    stopMoveInterval();
    setCranePosition({ x: 0, y: 1 });
    setControlPhase('await-right-press');
    setScore(null);
    setResultPopupReady(false);
    setResultPopupVisible(true);
    setPhase('play');
  };

  const handleLoadSampleQuestion = (questionIndex: number) => {
    const sampleQuestion = SAMPLE_QUESTIONS[questionIndex];
    if (!sampleQuestion) return;
    handleStartGame([sampleQuestion], 0);
  };

  const handleStartGame = (questionList: PaintingQuestion[], index: number = 0) => {
    stopMoveInterval();
    setQuestions(questionList);
    setCurrentQuestionIndex(index);
    setCranePosition({ x: 0, y: 1 });
    setControlPhase('await-right-press');
    setScore(null);
    setResultPopupReady(false);
    setResultPopupVisible(true);
    setPhase('play');
    setStep('play');
  };

  const handleBackToSelect = () => {
    stopMoveInterval();
    setStep('select');
    setPhase('play');
    setCranePosition({ x: 0, y: 1 });
    setControlPhase('await-right-press');
    setScore(null);
    setResultPopupReady(false);
    setResultPopupVisible(true);
  };

  // ======================== Effects ========================

  useEffect(() => {
    const saved = window.localStorage.getItem(CUSTOM_QUESTIONS_STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as PaintingQuestion[];
      if (Array.isArray(parsed)) {
        setSavedQuestions(parsed);
      }
    } catch {
      window.localStorage.removeItem(CUSTOM_QUESTIONS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'result') return;

    const startTime = Date.now();
    setResultPopupReady(false);

    const revealTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / RESULT_ANIMATION_MS, 1);
      setRevealProgress(progress);

      if (progress >= 1) {
        clearInterval(revealTimer);
      }
    }, 50);

    const popupTimer = window.setTimeout(() => {
      setResultPopupReady(true);
    }, RESULT_ANIMATION_MS + RESULT_POPUP_DELAY_MS);

    return () => {
      clearInterval(revealTimer);
      window.clearTimeout(popupTimer);
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      stopMoveInterval();
    };
  }, []);

  // ======================== Render Helpers ========================

  const canvasStyle = useMemo(
    () => ({
      aspectRatio: currentQuestion.aspectRatio,
    }),
    [currentQuestion.aspectRatio],
  );

  const setupCanvasStyle = useMemo(
    () => ({
      aspectRatio: setupImageAspectRatio,
    }),
    [setupImageAspectRatio],
  );

  const cranePositionStyle = useMemo(
    () => ({
      left: `${cranePosition.x * 100}%`,
      top: `${cranePosition.y * 100}%`,
    }),
    [cranePosition.x, cranePosition.y],
  );

  const targetPositionStyle = useMemo(
    () => ({
      left: `${currentQuestion.targetPoint.x * 100}%`,
      top: `${currentQuestion.targetPoint.y * 100}%`,
    }),
    [currentQuestion.targetPoint.x, currentQuestion.targetPoint.y],
  );

  const setupTargetPositionStyle = useMemo(
    () => (setupTargetPoint ? {
      left: `${setupTargetPoint.x * 100}%`,
      top: `${setupTargetPoint.y * 100}%`,
    } : {}),
    [setupTargetPoint],
  );

  // ======================== Render ========================

  return (
    <main className="page feature-page art-crane-page">
      <div className="title-with-home">
        <HomeIconLink />
        <h1>絵画クレーンゲーム</h1>
      </div>

      {/* STEP 1: Problem Setup */}
      {step === 'select' && (
        <section className="step-setup" aria-label="問題設定">
          <h2 className="step-title">問題作成</h2>

          {setupErrors.length > 0 && (
            <div className="setup-errors">
              {setupErrors.map((error, i) => (
                <div key={i} className="error-message">{error}</div>
              ))}
            </div>
          )}

          <div className="setup-form">
            {/* Image Upload */}
            <div className="setup-form-group">
              <label htmlFor="image-input" className="setup-label">
                1. 画像をアップロード
              </label>
              <div className="setup-file-picker">
                <input
                  ref={fileInputRef}
                  id="image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="setup-input-file-hidden"
                />
                <button
                  type="button"
                  className="setup-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ファイルを選択
                </button>
                <span className="setup-file-name">
                  {setupImage ? '選択済み' : 'ファイル未選択'}
                </span>
              </div>
            </div>

            {/* Canvas Preview */}
            {setupImage && (
              <div className="setup-form-group">
                <label className="setup-label">
                  2. ターゲット位置をクリック (サポイントが表示されます)
                </label>
                <div
                  ref={setupCanvasRef}
                  className="setup-canvas"
                  style={setupCanvasStyle}
                  onClick={handleCanvasClick}
                  role="img"
                  aria-label="ターゲット位置設定用キャンバス"
                >
                  <img src={setupImage} alt="プレビュー" className="setup-image" />
                  {setupTargetPoint && (
                    <div
                      className="art-crane-dot target-dot"
                      style={setupTargetPositionStyle}
                      aria-label="ターゲット位置"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Question Input */}
            <div className="setup-form-group">
              <label htmlFor="question-input" className="setup-label">
                3. 問題文を入力
              </label>
              <input
                id="question-input"
                type="text"
                placeholder="例: 富士山はどこ？"
                value={setupQuestion}
                onChange={(e) => setSetupQuestion(e.target.value)}
                className="setup-input-text"
              />
            </div>

            {/* Action Buttons */}
            <div className="setup-actions">
              <button
                type="button"
                onClick={handleStartSetupGame}
                className="setup-btn setup-btn-start"
              >
                ゲーム開始
              </button>
              <button
                type="button"
                onClick={() => {
                  resetSetup();
                  setSetupErrors([]);
                }}
                className="setup-btn setup-btn-reset"
              >
                リセット
              </button>
            </div>

            {/* Sample Buttons */}
            <div className="setup-sample">
              {SAMPLE_BUTTON_LABELS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleLoadSampleQuestion(index)}
                  className="setup-btn-sample"
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="saved-questions" aria-label="作成済問題集">
              <h3 className="saved-questions-title">作成済問題集</h3>

              {savedQuestions.length === 0 ? (
                <p className="saved-questions-empty">まだ保存された問題はありません。</p>
              ) : (
                <div className="saved-questions-list">
                  {savedQuestions.map((question) => (
                    <article key={question.id} className="saved-question-card">
                      <div
                        className="saved-question-thumb saved-question-thumb-placeholder"
                        style={{ aspectRatio: question.aspectRatio }}
                        aria-label="縦横比プレビュー"
                      />
                      <div className="saved-question-body">
                        <p className="saved-question-text">{question.question}</p>
                        <div className="saved-question-actions">
                          <button
                            type="button"
                            className="saved-question-btn saved-question-play-btn"
                            onClick={() => handlePlaySavedQuestion(question)}
                          >
                            プレイ
                          </button>
                          <button
                            type="button"
                            className="saved-question-btn saved-question-delete-btn"
                            onClick={() => handleDeleteSavedQuestion(question.id)}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {/* STEP 2: Play Game */}
      {step === 'play' && (
        <>
          {/* Play Phase */}
          {phase === 'play' && (
            <section className="art-crane-stage" aria-label="ゲーム進行">
              <p className="art-crane-question-text">{currentQuestion.question}</p>
              <div className="art-crane-canvas-wrap">
                <div ref={canvasRef} className="art-crane-canvas" style={canvasStyle}>
                  {/* Black Background */}
                  <div className="art-crane-black-background" />
                  {/* Crane Position (Red) */}
                  <div
                    className="art-crane-dot crane-dot"
                    style={cranePositionStyle}
                    aria-label="クレーン位置"
                  />
                </div>
              </div>

              <div className="art-crane-controls">
                <button
                  type="button"
                  className="move-btn move-btn-right"
                  aria-label="右へ移動(長押し)"
                  disabled={!(controlPhase === 'await-right-press' || controlPhase === 'right-holding')}
                  onPointerDown={() => startLongPress('right')}
                  onPointerUp={() => endLongPress('right')}
                  onPointerLeave={() => endLongPress('right')}
                  onPointerCancel={() => endLongPress('right')}
                >
                  →
                </button>
                <button
                  type="button"
                  className="move-btn move-btn-up"
                  aria-label="上へ移動(長押し)"
                  disabled={!(controlPhase === 'await-up-press' || controlPhase === 'up-holding')}
                  onPointerDown={() => startLongPress('up')}
                  onPointerUp={() => endLongPress('up')}
                  onPointerLeave={() => endLongPress('up')}
                  onPointerCancel={() => endLongPress('up')}
                >
                  ↑
                </button>
              </div>

              <button
                type="button"
                className="submit-btn"
                onClick={submitAnswer}
                aria-label="答えを提出"
              >
                ここにしておきます
              </button>

              <button
                type="button"
                className="back-to-select-btn"
                onClick={handleBackToSelect}
                aria-label="設定に戻る"
              >
                ← 設定に戻る
              </button>
            </section>
          )}

          {/* Result Phase */}
          {phase === 'result' && (
            <section
              className="art-crane-stage result-stage"
              aria-label="結果表示"
              onClick={() => {
                if (!resultPopupReady) return;
                if (resultPopupVisible) {
                  setResultPopupVisible(false);
                } else {
                  setResultPopupVisible(true);
                }
              }}
            >
              <div className="art-crane-canvas-wrap">
                <div
                  ref={canvasRef}
                  className="art-crane-canvas"
                  style={canvasStyle}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    setDebugClickPoint({ x, y });
                    e.stopPropagation();
                  }}
                >
                  {/* Revealed Image */}
                  <img
                    src={currentQuestion.imageUrl}
                    alt={currentQuestion.question}
                    className="art-crane-image"
                    style={{
                      opacity: revealProgress,
                    }}
                  />
                  {/* Target Position (Blue) */}
                  <div
                    className="art-crane-dot target-dot"
                    style={targetPositionStyle}
                    aria-label="ターゲット位置"
                  />
                  {/* Crane Position (Red) */}
                  <div
                    className="art-crane-dot crane-dot"
                    style={cranePositionStyle}
                    aria-label="プレイヤーの位置"
                  />
                  {/* Debug Click Coordinate Display */}
                  {debugClickPoint && (
                    <div
                      className="debug-coord-label"
                      style={{
                        position: 'absolute',
                        left: `${debugClickPoint.x * 100}%`,
                        top: `${debugClickPoint.y * 100}%`,
                        transform: 'translate(-50%, -130%)',
                        background: 'rgba(0,0,0,0.85)',
                        color: '#fff',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        zIndex: 100,
                        userSelect: 'none',
                      }}
                    >
                      x: {debugClickPoint.x.toFixed(2)}, y: {debugClickPoint.y.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {resultPopupReady && score !== null && resultPopupVisible && (
                <div className="result-popup">
                  <div className="result-content" onClick={(e) => e.stopPropagation()}>
                    <h2>得点</h2>
                    <p className="result-score">{score.toLocaleString()}</p>
                    <div className="result-buttons">
                      <button
                        type="button"
                        className="result-btn hide-result-btn"
                        onClick={() => setResultPopupVisible(false)}
                      >
                        非表示
                      </button>
                      <button type="button" className="result-btn retry-btn" onClick={handleRetry}>
                        リトライ
                      </button>
                      <button
                        type="button"
                        className="result-btn back-select-btn"
                        onClick={handleBackToSelect}
                      >
                        問題設定に戻る
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {resultPopupReady && score !== null && !resultPopupVisible && (
                <div className="result-restore-hint" aria-hidden="true">
                  画面をタップすると得点を再表示
                </div>
              )}
            </section>
          )}
        </>
      )}

      <Link to="/" className="back-link">
        ← ホームに戻る
      </Link>
    </main>
  );
}
