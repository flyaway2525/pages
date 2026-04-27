import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';

interface Item {
  name: string;
  values: number[];
}

interface GameState {
  items: Item[];
  axisTitle: string;
  timeLabels: string[];
  currentTimepoint: number;
  progressTicks: number;
  isRunning: boolean;
  finished: boolean;
}

interface RunnerColor {
  fill: string;
  text: string;
  shadow: string;
}

const RUNNER_COLOR_PALETTE: RunnerColor[] = [
  { fill: '#f3f4f6', text: '#111827', shadow: 'rgba(107, 114, 128, 0.35)' },
  { fill: '#111111', text: '#ffffff', shadow: 'rgba(17, 17, 17, 0.45)' },
  { fill: '#dc2626', text: '#ffffff', shadow: 'rgba(220, 38, 38, 0.38)' },
  { fill: '#1d4ed8', text: '#ffffff', shadow: 'rgba(29, 78, 216, 0.38)' },
  { fill: '#facc15', text: '#111827', shadow: 'rgba(250, 204, 21, 0.45)' },
  { fill: '#16a34a', text: '#ffffff', shadow: 'rgba(22, 163, 74, 0.38)' },
  { fill: '#ea580c', text: '#ffffff', shadow: 'rgba(234, 88, 12, 0.38)' },
  { fill: '#db2777', text: '#ffffff', shadow: 'rgba(219, 39, 119, 0.38)' },
  { fill: '#6d28d9', text: '#ffffff', shadow: 'rgba(109, 40, 217, 0.38)' },
  { fill: '#0ea5e9', text: '#ffffff', shadow: 'rgba(14, 165, 233, 0.38)' },
];

const hashText = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const getGeneratedRunnerColor = (key: string): RunnerColor => {
  const hash = hashText(key);
  const hue = hash % 360;
  const saturation = 60 + (hash % 18);
  const lightness = 42 + ((hash >>> 8) % 18);
  const text = lightness >= 56 ? '#111827' : '#ffffff';

  return {
    fill: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    text,
    shadow: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 10, 18)}%, 0.38)`,
  };
};

const getRunnerColor = (runnerIndex: number, runnerName: string): RunnerColor => {
  if (runnerIndex < RUNNER_COLOR_PALETTE.length) {
    return RUNNER_COLOR_PALETTE[runnerIndex];
  }
  return getGeneratedRunnerColor(`${runnerName}-${runnerIndex}`);
};

export default function DataDerby() {
  const ROW_STRIDE_PX = 38;
  const RANK_LERP_FACTOR = 0.038;
  const TICKS_PER_TIMEPOINT = 100;
  const TIMEPOINT_MS = 340;
  const TICK_INTERVAL_MS = Math.max(4, Math.round(TIMEPOINT_MS / TICKS_PER_TIMEPOINT));

  const [gameState, setGameState] = useState<GameState>({
    items: [],
    axisTitle: 'date',
    timeLabels: [],
    currentTimepoint: 0,
    progressTicks: 0,
    isRunning: false,
    finished: false,
  });

  const [formData, setFormData] = useState({
    itemName: '',
    values: '',
  });
  const [chartTitle, setChartTitle] = useState('');
  const [tableText, setTableText] = useState('');
  const [tableError, setTableError] = useState('');
  const [isLoadingCsvSample, setIsLoadingCsvSample] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [insufficientItemNames, setInsufficientItemNames] = useState<Set<string>>(new Set());
  const [isResultPopupOpen, setIsResultPopupOpen] = useState(false);
  const [isVotePhase, setIsVotePhase] = useState(false);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const showManualItemInput = false;
  const displayedRankByItemRef = useRef(new Map<number, number>());
  const targetRankByItemRef = useRef(new Map<number, number>());
  const rankAnimationFrameRef = useRef<number | null>(null);
  const resultPopupTimerRef = useRef<number | null>(null);
  const rowElementByItemRef = useRef(new Map<number, HTMLDivElement>());

  const formatDelimitedCell = (value: string | number) => {
    const text = String(value);
    if (/[",\n\t]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const buildTableText = (axisTitle: string, timeLabels: string[], items: Item[]) => {
    if (items.length === 0) {
      return '';
    }

    const normalizedAxisTitle = axisTitle.trim() || 'date';
    const maxRows = Math.max(...items.map((item) => item.values.length), 0);
    const header = [normalizedAxisTitle, ...items.map((item) => item.name)];
    const rows = Array.from({ length: maxRows }, (_, rowIndex) => {
      const label = timeLabels[rowIndex] || `${normalizedAxisTitle}${rowIndex + 1}`;
      return [
        label,
        ...items.map((item) =>
          item.values[rowIndex] !== undefined ? item.values[rowIndex] : ''
        ),
      ];
    });

    return [
      header.map((cell) => formatDelimitedCell(cell)).join(','),
      ...rows.map((row) => row.map((cell) => formatDelimitedCell(cell)).join(',')),
    ].join('\n');
  };

  const parseTableData = (rawText: string) => {
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return null;
    }

    const header = parseDelimitedLine(lines[0]);
    if (header.length < 3) {
      return { error: '1列目にdate、2列目以降に項目名が必要です。' };
    }

    const itemNames = header.slice(1).map((name) => name.trim()).filter(Boolean);
    if (itemNames.length < 2) {
      return { error: '項目列が2つ以上必要です。' };
    }

    const valuesByItem = itemNames.map((name) => ({ name, values: [] as number[] }));
    const collectedLabels: string[] = [];

    for (const line of lines.slice(1)) {
      const cells = parseDelimitedLine(line);
      collectedLabels.push(cells[0]?.trim() ?? '');
      itemNames.forEach((_, index) => {
        const rawValue = cells[index + 1] ?? '';
        const numericValue = Number(rawValue.replace(/,/g, ''));
        if (Number.isFinite(numericValue)) {
          valuesByItem[index].values.push(numericValue);
        }
      });
    }

    const items = valuesByItem.filter((item) => item.values.length >= 2);
    if (items.length < 2) {
      return { error: '2つ以上の項目に対して、2時点以上の数値が必要です。' };
    }

    return {
      axisTitle: header[0]?.trim() || 'date',
      timeLabels: collectedLabels,
      items,
    };
  };

  useEffect(() => {
    setTableText(buildTableText(gameState.axisTitle, gameState.timeLabels, gameState.items));
  }, [gameState.axisTitle, gameState.items, gameState.timeLabels]);

  useEffect(() => {
    const validation = validateGameData();
    setValidationErrors(validation.errors);
    if (!validation.isValid) {
      const insufficientItems = gameState.items.filter((item) => item.values.length < 2);
      setInsufficientItemNames(new Set(insufficientItems.map((i) => i.name)));
    } else {
      setInsufficientItemNames(new Set());
    }
  }, [gameState.items, gameState.timeLabels]);

  const addItem = () => {
    if (!formData.itemName.trim() || !formData.values.trim()) return;

    const values = formData.values
      .split(',')
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v));

    if (values.length === 0) return;

    setGameState((prev) => ({
      ...prev,
      items: [...prev.items, { name: formData.itemName, values }],
      axisTitle: prev.axisTitle || '番号',
    }));

    setFormData({ itemName: '', values: '' });
  };

  const validateGameData = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // 頁E��数ぁE以上か確誁E
    if (gameState.items.length < 2) {
      errors.push('項目が2つ以上必要です。');
    }

    // 時系列データぁEつ以上か確誁E
    if (gameState.timeLabels.length < 2) {
      errors.push('時系列データが2つ以上必要です。');
    }

    // すべての頁E��が十刁E��チE�Eタ値を持つか確誁E
    const insufficientItems = gameState.items.filter((item) => item.values.length < 2);
    if (insufficientItems.length > 0) {
      errors.push(`${insufficientItems.map((i) => i.name).join(', ')} ぁEつ以上�EチE�Eタ値を持つ忁E��があります。`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  const startRace = () => {
    const validation = validateGameData();

    if (!validation.isValid) {
      alert(`レースを開始できません:\n\n${validation.errors.join('\n')}`);
      return;
    }

    setIsVotePhase(false);
    displayedRankByItemRef.current = new Map();
    targetRankByItemRef.current = new Map();
    if (resultPopupTimerRef.current !== null) {
      clearTimeout(resultPopupTimerRef.current);
      resultPopupTimerRef.current = null;
    }
    setIsResultPopupOpen(false);

    setGameState((prev) => {
      const maxTimepoint = Math.max(
        ...prev.items.map((item) => item.values.length - 1)
      );

      const newState = {
        ...prev,
        currentTimepoint: 0,
        progressTicks: 0,
        isRunning: true,
        finished: false,
      };

      // アニメーション開姁E
      setTimeout(() => animateRaceWithMaxTimepoint(maxTimepoint), 0);

      return newState;
    });
  };

  const animateRaceWithMaxTimepoint = (maxTimepoint: number) => {
    let progressTick = 0;
    const maxProgressTick = maxTimepoint * TICKS_PER_TIMEPOINT;

    const interval = setInterval(() => {
      const timepoint = Math.floor(progressTick / TICKS_PER_TIMEPOINT);

      setGameState((prev) => ({
        ...prev,
        currentTimepoint: timepoint,
        progressTicks: progressTick,
      }));

      if (progressTick >= maxProgressTick) {
        clearInterval(interval);
        setGameState((prev) => ({
          ...prev,
          currentTimepoint: maxTimepoint,
          progressTicks: maxProgressTick,
          isRunning: false,
          finished: true,
        }));
        return;
      }

      progressTick++;
    }, TICK_INTERVAL_MS);
  };

  const resetGame = () => {
    if (rankAnimationFrameRef.current !== null) {
      cancelAnimationFrame(rankAnimationFrameRef.current);
      rankAnimationFrameRef.current = null;
    }
    if (resultPopupTimerRef.current !== null) {
      clearTimeout(resultPopupTimerRef.current);
      resultPopupTimerRef.current = null;
    }

    displayedRankByItemRef.current = new Map();
    targetRankByItemRef.current = new Map();

    setGameState({
      items: [],
      axisTitle: 'date',
      timeLabels: [],
      currentTimepoint: 0,
      progressTicks: 0,
      isRunning: false,
      finished: false,
    });
    setFormData({ itemName: '', values: '' });
    setIsResultPopupOpen(false);
    setIsVotePhase(false);
    setShowAllCandidates(false);
  };

  const goToVotePhase = () => {
    const validation = validateGameData();
    setValidationErrors(validation.errors);
    if (!validation.isValid) {
      alert(`投票フェーズへ進めません:\n\n${validation.errors.join('\n')}`);
      return;
    }
    setShowAllCandidates(false);
    setIsVotePhase(true);
  };

  const parseDelimitedLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];

      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && (char === ',' || char === '\t')) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  };

  const syncTableTextToItems = (nextTableText: string, showIncompleteError = false) => {
    const lines = nextTableText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setGameState((prev) => ({
        ...prev,
        items: [],
        axisTitle: 'date',
        timeLabels: [],
        currentTimepoint: 0,
        progressTicks: 0,
        isRunning: false,
        finished: false,
      }));
      setTableError('');
      return;
    }

    if (lines.length < 2) {
      if (showIncompleteError) {
        setTableError('ヘッダー行とデータ行を含む表を貼り付けてください。');
      } else {
        setTableError('');
      }
      return;
    }

    const parsed = parseTableData(nextTableText);
    if (!parsed) {
      setTableError('ヘッダー行とデータ行を含む表を貼り付けてください。');
      return;
    }

    if ('error' in parsed) {
      setTableError(parsed.error ?? '表データを読み取れませんでした。');
      return;
    }

    setGameState((prev) => ({
      ...prev,
      items: parsed.items,
      axisTitle: parsed.axisTitle,
      timeLabels: parsed.timeLabels,
      currentTimepoint: 0,
      progressTicks: 0,
      isRunning: false,
      finished: false,
    }));
    setTableError('');
  };

  const importTableData = () => {
    syncTableTextToItems(tableText, true);
    // バリチE�Eション実行後に結果を更新
    setTimeout(() => {
      const validation = validateGameData();
      setValidationErrors(validation.errors);
      if (!validation.isValid) {
        const insufficientItems = gameState.items.filter((item) => item.values.length < 2);
        setInsufficientItemNames(new Set(insufficientItems.map((i) => i.name)));
      } else {
        setInsufficientItemNames(new Set());
      }
    }, 0);
  };

  const handleTableTextChange = (nextTableText: string) => {
    setTableText(nextTableText);
    if (tableError) {
      setTableError('');
    }
  };

  const removePreviewColumn = (columnIndex: number) => {
    if (columnIndex === 0) {
      return;
    }

    const updatedText = tableText
      .split(/\r?\n/)
      .map((line) => {
        if (!line.trim()) {
          return line;
        }
        const cells = parseDelimitedLine(line);
        if (columnIndex >= cells.length) {
          return cells.map((cell) => formatDelimitedCell(cell)).join(',');
        }
        const nextCells = [...cells];
        nextCells.splice(columnIndex, 1);
        return nextCells.map((cell) => formatDelimitedCell(cell)).join(',');
      })
      .join('\n');

    setTableText(updatedText);
    setTableError('');
  };

  const loadCsvSampleToTextarea = async () => {
    setIsLoadingCsvSample(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-data/japan-population-prefectures.csv`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      setTableText(csvText.trim());
      setChartTitle('都道府県の人口ランキング');
      setTableError('');
    } catch {
      setTableError('日本人口サンプルCSVの読み込みに失敗しました。');
    } finally {
      setIsLoadingCsvSample(false);
    }
  };

  const loadYoaosobi = async () => {
    setIsLoadingCsvSample(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-data/yoasobi-billboard-japan.csv`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      setTableText(csvText.trim());
      setChartTitle('YOASOBI Billboard Japan - 月別ストリーミング再生回数');
      setTableError('');
    } catch {
      setTableError('YOASOBI CSVの読み込みに失敗しました。');
    } finally {
      setIsLoadingCsvSample(false);
    }
  };

  const loadAozoraRanking = async () => {
    setIsLoadingCsvSample(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-data/aozora-access-ranking.csv`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      setTableText(csvText.trim());
      setChartTitle('青空文庫のアクセス数ランキング - 2009-2022 累計');
      setTableError('');
    } catch {
      setTableError('青空文庫CSVの読み込みに失敗しました。');
    } finally {
      setIsLoadingCsvSample(false);
    }
  };

  const loadSummerOlympicsRanking = async () => {
    setIsLoadingCsvSample(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-data/summer-olympics-medals.csv`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const csvText = await response.text();
      setTableText(csvText.trim());
      setChartTitle('夏季オリンピックの国別メダル総獲得数ランキング - 1908-2024');
      setTableError('');
    } catch {
      setTableError('夏季オリンピックCSVの読み込みに失敗しました。');
    } finally {
      setIsLoadingCsvSample(false);
    }
  };

  const handleSampleDatasetSelectChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = event.target.value;
    if (!selected) {
      return;
    }

    switch (selected) {
      case 'japan-population':
        await loadCsvSampleToTextarea();
        break;
      case 'yoasobi':
        await loadYoaosobi();
        break;
      case 'aozora':
        await loadAozoraRanking();
        break;
      case 'summer-olympics':
        await loadSummerOlympicsRanking();
        break;
      default:
        break;
    }

    event.target.value = '';
  };

  const resetSampleInput = () => {
    setChartTitle('');
    setTableText('');
    syncTableTextToItems('');
  };

  const buildTablePreview = () => {
    const lines = tableText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return null;
    }

    const header = parseDelimitedLine(lines[0]);
    if (header.length < 2) {
      return null;
    }

    const allRows = lines.slice(1).map((line) => parseDelimitedLine(line));
    const maxColumns = Math.min(header.length, 12);
    const maxRows = Math.min(allRows.length, 12);

    // 列ごとに数値配�Eを収雁E��E列目は軸なので1列目以降！E
    const colValues: (number | undefined)[][] = Array.from({ length: maxColumns - 1 }, (_, colIdx) =>
      allRows.slice(0, maxRows).map((row) => {
        const raw = (row[colIdx + 1] ?? '').replace(/,/g, '').trim();
        const num = Number(raw);
        return raw !== '' && Number.isFinite(num) ? num : undefined;
      })
    );

    const getPreviewFill = (values: (number | undefined)[], t: number): number => {
      if (values[t] !== undefined) return values[t]!;
      let before: number | undefined;
      for (let i = t - 1; i >= 0; i--) { if (values[i] !== undefined) { before = values[i]; break; } }
      let after: number | undefined;
      for (let i = t + 1; i < values.length; i++) { if (values[i] !== undefined) { after = values[i]; break; } }
      if (before === undefined && after === undefined) return 0;
      if (before === undefined) return 0;
      if (after === undefined) return before;
      return Math.round((before + after) / 2);
    };

    const rows = allRows.slice(0, maxRows).map((row, rowIndex) =>
      Array.from({ length: maxColumns }, (_, colIndex) => {
        if (colIndex === 0) {
          const axisVal = row[0]?.trim() ?? '';
          return { display: axisVal, isMissing: axisVal === '' };
        }
        const raw = (row[colIndex] ?? '').replace(/,/g, '').trim();
        const num = Number(raw);
        const isMissing = raw === '' || !Number.isFinite(num);
        if (isMissing) {
          const fill = getPreviewFill(colValues[colIndex - 1], rowIndex);
          return { display: fill.toLocaleString(), isMissing: true };
        }
        return { display: num.toLocaleString(), isMissing: false };
      })
    );

    return {
      header: header.slice(0, maxColumns),
      rows,
      totalRows: allRows.length,
      totalColumns: header.length,
    };
  };

  const currentRanking = useMemo(() => {
    return gameState.items
      .map((item, index) => ({
        index,
        name: item.name,
        value:
          item.values[
            Math.min(gameState.currentTimepoint, item.values.length - 1)
          ],
      }))
      .sort((a, b) => b.value - a.value);
  }, [gameState.items, gameState.currentTimepoint]);

  const visibleRanking = useMemo(() => currentRanking.slice(0, 10), [currentRanking]);

  const totalTimepoints = Math.max(...gameState.items.map((item) => item.values.length), 0);
  const progressTimepoint = gameState.progressTicks / TICKS_PER_TIMEPOINT;
  const interpolatedVisibleRanking = useMemo(() => {
    return visibleRanking.map((rankedItem) => {
      const sourceItem = gameState.items[rankedItem.index];
      if (!sourceItem || sourceItem.values.length === 0) {
        return {
          ...rankedItem,
          renderedValue: rankedItem.value,
        };
      }

      const clampedTime = Math.max(0, Math.min(progressTimepoint, sourceItem.values.length - 1));
      const leftIndex = Math.floor(clampedTime);
      const rightIndex = Math.min(leftIndex + 1, sourceItem.values.length - 1);
      const leftValue = sourceItem.values[leftIndex] ?? rankedItem.value;
      const rightValue = sourceItem.values[rightIndex] ?? leftValue;
      const blend = clampedTime - leftIndex;

      return {
        ...rankedItem,
        renderedValue: leftValue + (rightValue - leftValue) * blend,
      };
    });
  }, [visibleRanking, gameState.items, progressTimepoint]);

  const maxValue = useMemo(
    () => Math.max(...interpolatedVisibleRanking.map((r) => r.renderedValue), 1),
    [interpolatedVisibleRanking]
  );
  const raceProgress = totalTimepoints > 0
    ? ((Math.min(progressTimepoint + 1, totalTimepoints) / totalTimepoints) * 100)
    : 0;
  const currentTimeLabel = gameState.timeLabels[gameState.currentTimepoint]
    || `${gameState.axisTitle || 'date'}${gameState.currentTimepoint + 1}`;
  const currentStepDisplay = totalTimepoints > 0
    ? Math.min(progressTimepoint + 1, totalTimepoints)
    : 0;
  const tablePreview = buildTablePreview();

  useEffect(() => {
    const nextTargetRank = new Map<number, number>(
      visibleRanking.map((item, rank) => [item.index, rank])
    );
    targetRankByItemRef.current = nextTargetRank;

    nextTargetRank.forEach((rank, itemIndex) => {
      if (!displayedRankByItemRef.current.has(itemIndex)) {
        displayedRankByItemRef.current.set(itemIndex, rank + 0.8);
      }

      const rowElement = rowElementByItemRef.current.get(itemIndex);
      if (rowElement) {
        const displayedRank = displayedRankByItemRef.current.get(itemIndex) ?? rank;
        rowElement.style.top = `${displayedRank * ROW_STRIDE_PX}px`;
      }
    });
  }, [visibleRanking]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const step = () => {
      const nextDisplayedRank = new Map<number, number>();
      let hasMovement = false;

      targetRankByItemRef.current.forEach((targetRank, itemIndex) => {
        const currentDisplayedRank = displayedRankByItemRef.current.get(itemIndex) ?? targetRank;
        if (reducedMotion) {
          nextDisplayedRank.set(itemIndex, targetRank);
          return;
        }

        const delta = targetRank - currentDisplayedRank;
        if (Math.abs(delta) < 0.008) {
          nextDisplayedRank.set(itemIndex, targetRank);
          return;
        }

        hasMovement = true;
        nextDisplayedRank.set(itemIndex, currentDisplayedRank + delta * RANK_LERP_FACTOR);
      });

      displayedRankByItemRef.current = nextDisplayedRank;

      nextDisplayedRank.forEach((displayedRank, itemIndex) => {
        const rowElement = rowElementByItemRef.current.get(itemIndex);
        if (rowElement) {
          rowElement.style.top = `${displayedRank * ROW_STRIDE_PX}px`;
        }
      });

      if (gameState.isRunning || hasMovement) {
        rankAnimationFrameRef.current = requestAnimationFrame(step);
      } else {
        rankAnimationFrameRef.current = null;
      }
    };

    if (rankAnimationFrameRef.current === null) {
      rankAnimationFrameRef.current = requestAnimationFrame(step);
    }

    return () => {
      if (rankAnimationFrameRef.current !== null) {
        cancelAnimationFrame(rankAnimationFrameRef.current);
        rankAnimationFrameRef.current = null;
      }
    };
  }, [gameState.isRunning, visibleRanking]);

  useEffect(() => {
    if (resultPopupTimerRef.current !== null) {
      clearTimeout(resultPopupTimerRef.current);
      resultPopupTimerRef.current = null;
    }

    if (!gameState.finished) {
      setIsResultPopupOpen(false);
      return;
    }

    resultPopupTimerRef.current = window.setTimeout(() => {
      setIsResultPopupOpen(true);
      resultPopupTimerRef.current = null;
    }, 1000);

    return () => {
      if (resultPopupTimerRef.current !== null) {
        clearTimeout(resultPopupTimerRef.current);
        resultPopupTimerRef.current = null;
      }
    };
  }, [gameState.finished]);

  const winHorse = visibleRanking[0];
  const placeHorses = visibleRanking.slice(0, 3);
  const trifectaHorses = visibleRanking.slice(0, 3);
  const voteCandidates = gameState.items.map((item, index) => ({
    index,
    name: item.name,
  }));
  const displayedVoteCandidates = showAllCandidates ? voteCandidates : voteCandidates.slice(0, 10);
  const voteTopicTitle = chartTitle.trim() || `${gameState.axisTitle || 'date'}の推移レース`;
  const voteTopicPeriod = gameState.timeLabels.length >= 2
    ? `${gameState.timeLabels[0]} 〜 ${gameState.timeLabels[gameState.timeLabels.length - 1]}`
    : '';

  const getVoteCellSizeClass = (nameLength: number) => {
    if (nameLength <= 6) {
      return 'vote-cell-short';
    }
    if (nameLength <= 10) {
      return 'vote-cell-medium';
    }
    if (nameLength <= 14) {
      return 'vote-cell-long';
    }
    return 'vote-cell-xlong';
  };

  const renderTicketSquares = (items: Array<{ index: number; name: string }>) => {
    if (items.length === 0) {
      return <span className="derby-ticket-empty">-</span>;
    }

    return (
      <div className="ticket-square-strip" aria-hidden="true">
        {items.map((item, idx) => {
          const runnerColor = getRunnerColor(item.index, item.name);
          return (
            <Fragment key={`ticket-${item.index}-${item.name}`}>
              {idx > 0 && <span className="ticket-separator">-</span>}
              <div className="ticket-square-item">
                <span
                  className="ticket-square"
                  style={{ background: runnerColor.fill, color: runnerColor.text }}
                >
                  {item.index + 1}
                </span>
                <span className="ticket-square-caption" title={item.name}>{item.name}</span>
              </div>
            </Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <main className="page data-derby-page">
      <h1>データダービー</h1>
      <p>バーチャートレースの着順を予想するゲームです。</p>

      {!gameState.isRunning && !gameState.finished && !isVotePhase && (
        <section className="derby-input-section">
          <h2>ステップ1: データを準備</h2>
          <div className="input-form">
            {showManualItemInput && (
              <>
                <div className="form-group">
                  <label>項目名（例：走馬灯）</label>
                  <input
                    type="text"
                    placeholder="例： アイドル"
                    value={formData.itemName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        itemName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label>時系列データ（カンマ区切り）</label>
                  <input
                    type="text"
                    placeholder="例： 100,200,350,500"
                    value={formData.values}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        values: e.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label>タイトル</label>
              <input
                type="text"
                placeholder="例： 都道府県の人口ランキング"
                value={chartTitle}
                onChange={(e) => setChartTitle(e.target.value)}
              />
            </div>
            <div className="input-actions">
              {showManualItemInput && (
                <button onClick={addItem} className="btn-add">
                  項目を追加
                </button>
              )}
              <div className="sample-data-select-wrap">
                <label htmlFor="sample-data-select">サンプルデータ :</label>
                <select
                  id="sample-data-select"
                  onChange={handleSampleDatasetSelectChange}
                  defaultValue=""
                  disabled={isLoadingCsvSample}
                >
                  <option value="" disabled>{isLoadingCsvSample ? '読み込み中...' : '選択してください'}</option>
                  <option value="japan-population">例題 : 都道府県人口</option>
                  <option value="yoasobi">1問目 : YOASHOBI 再生回数</option>
                  <option value="aozora">2問目 : 青空文庫アクセス数</option>
                  <option value="summer-olympics">3問目 : 夏季五輪国別メダル獲得数</option>
                </select>
                <button
                  type="button"
                  className="btn-sample-reset"
                  onClick={resetSampleInput}
                  disabled={isLoadingCsvSample}
                >
                  リセット
                </button>
              </div>
            </div>

            <section className="table-import-panel">
              <div className="table-import-head">
                <div>
                  <h3>表形式でまとめて貼り付け</h3>
                  <p>1列目をdate、2列目以降を項目名にした CSV / TSV をそのまま貼れます。編集は反映されず、「データを読み込む」で更新されます。</p>
                </div>
                <div className="table-import-actions">
                  <button type="button" className="btn-import-table" onClick={importTableData}>
                    データを読み込む
                  </button>
                  <button
                    type="button"
                    onClick={goToVotePhase}
                    className="btn-start-race"
                    disabled={gameState.items.length === 0}
                  >
                    レース準備OK
                  </button>
                </div>
              </div>
              <textarea
                className="table-import-textarea"
                value={tableText}
                onChange={(e) => handleTableTextChange(e.target.value)}
                wrap="off"
                placeholder={[
                  'date,Belgium,China,France',
                  '2020-04-08,2240,3337,10887',
                  '2020-04-09,2523,3339,12228',
                  '2020-04-10,3019,3340,13215',
                ].join('\n')}
              />
              {tablePreview && (
                <div className="table-preview-wrap">
                  <p className="table-preview-caption">
                    プレビュー: {tablePreview.totalRows}行 / {tablePreview.totalColumns}列
                  </p>
                  <table className="table-preview">
                    <thead>
                      <tr className="preview-header-actions">
                        <th scope="col"></th>
                        {tablePreview.header.slice(1).map((_, index) => (
                          <th key={`preview-action-${index}`} scope="col" className="preview-action-cell">
                            <button
                              type="button"
                              className="btn-remove"
                              onClick={() => removePreviewColumn(index + 1)}
                            >
                              削除
                            </button>
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {tablePreview.header.map((label, index) => (
                          <th
                            key={`${label}-${index}`}
                            scope="col"
                            className={label.trim() === '' ? 'pivot-cell-missing' : undefined}
                          >
                            {label.trim() || `col_${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tablePreview.rows.map((row, rowIndex) => (
                        <tr key={`preview-row-${rowIndex}`}>
                          {row.map((cell, cellIndex) => {
                            const hdr = tablePreview.header[cellIndex]?.trim() || '';
                            const isError = insufficientItemNames.has(hdr);
                            const classes = (cell.isMissing ? 'pivot-cell-missing' : '') + (isError && !cell.isMissing ? ' validation-error' : '');
                            return (
                              <td
                                key={`preview-cell-${rowIndex}-${cellIndex}`}
                                className={classes || undefined}
                                title={cell.isMissing ? `補完値: ${cell.display}` : undefined}
                              >
                                {cell.display}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(tablePreview.totalRows > tablePreview.rows.length ||
                    tablePreview.totalColumns > tablePreview.header.length) && (
                    <p className="table-preview-note">表示を軽くするため、先頭の一部のみ表示しています。</p>
                  )}
                </div>
              )}
              {tableError && <p className="table-import-error">{tableError}</p>}
            </section>
          </div>

        </section>
      )}

      {!gameState.isRunning && !gameState.finished && isVotePhase && (
        <section className="derby-vote-section">
          <h2>ステップ2: 投票フェーズ</h2>
          <div className="vote-topic-card">
            <p className="vote-topic-label">今回のお題</p>
            <h3>{voteTopicTitle}</h3>
            {voteTopicPeriod && <p className="vote-topic-period">対象期間: {voteTopicPeriod}</p>}
            <p className="vote-topic-description">単勝・複勝・3連単を予想してから、レースを開始してください。</p>
          </div>

          <div className="vote-phase-panel">
            <ul className="vote-candidate-list">
              {displayedVoteCandidates.map((item) => {
                const runnerColor = getRunnerColor(item.index, item.name);
                const nameLength = Array.from(item.name).length;
                return (
                  <li
                    key={`vote-${item.index}`}
                    className={`vote-candidate-item ${getVoteCellSizeClass(nameLength)}`.trim()}
                  >
                    <span
                      className="vote-number-chip"
                      style={{ background: runnerColor.fill, color: runnerColor.text }}
                    >
                      {item.index + 1}
                    </span>
                    <span className="vote-candidate-name">{item.name}</span>
                  </li>
                );
              })}
            </ul>

            {voteCandidates.length > 10 && (
              <button
                type="button"
                className="btn-toggle-candidates"
                onClick={() => setShowAllCandidates((prev) => !prev)}
              >
                {showAllCandidates ? '11位以降を隠す' : '11位以降も表示'}
              </button>
            )}

            <div className="vote-phase-actions">
              <button type="button" className="btn-back-vote" onClick={() => setIsVotePhase(false)}>
                データ入力へ戻る
              </button>
              <button type="button" className="btn-start-race" onClick={startRace}>
                レース開始
              </button>
            </div>
          </div>
        </section>
      )}

      {(gameState.isRunning || gameState.finished) && (
        <section
          className={`derby-race-section ${gameState.isRunning ? 'is-running' : ''} ${gameState.finished ? 'is-finished' : ''}`.trim()}
        >
          <h2>ステップ3: バーチャートレース</h2>
          {chartTitle.trim() && <p className="derby-chart-title">{chartTitle}</p>}

          <div className={`race-container ${gameState.isRunning ? 'running' : ''} ${gameState.finished ? 'finished' : ''}`.trim()}>
            <div className="bar-chart" style={{ height: `${interpolatedVisibleRanking.length * ROW_STRIDE_PX}px` }}>
              {interpolatedVisibleRanking.map((item, rank) => {
                const runnerColor = getRunnerColor(item.index, item.name);
                const displayedRank = displayedRankByItemRef.current.get(item.index) ?? rank;

                return (
                  <div
                    key={item.index}
                    className={`bar-row ${rank === 0 ? 'is-leader' : ''}`.trim()}
                    style={{ top: `${displayedRank * ROW_STRIDE_PX}px` }}
                    ref={(node) => {
                      if (node) {
                        rowElementByItemRef.current.set(item.index, node);
                      } else {
                        rowElementByItemRef.current.delete(item.index);
                      }
                    }}
                  >
                    <div className="rank-badge">#{rank + 1}</div>
                    <div className="bar-bg">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${(item.renderedValue / maxValue) * 100}%`,
                          background: runnerColor.fill,
                          color: runnerColor.text,
                          boxShadow: `0 3px 8px ${runnerColor.shadow}`,
                          transition: gameState.isRunning
                            ? 'width 0.54s cubic-bezier(0.22, 1, 0.36, 1)'
                            : 'none',
                        }}
                      >
                        <span
                          className="bar-name"
                          style={{ textShadow: runnerColor.text === '#ffffff' ? '0 1px 2px rgba(15, 23, 42, 0.45)' : 'none' }}
                        >
                          {item.name}
                        </span>
                      </div>
                    </div>
                    <div className="bar-value">{Math.round(item.renderedValue).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {gameState.isRunning && (
            <p className="race-info" aria-live="polite">
              {gameState.axisTitle || 'date'}: {currentTimeLabel} ({currentStepDisplay.toFixed(1)} / {totalTimepoints})
            </p>
          )}

          <div className="race-progress-wrap">
            <div className="race-progress-track">
              <div className="race-progress-fill" style={{ width: `${raceProgress}%` }} />
            </div>
            <span className="race-progress-text">Progress {raceProgress.toFixed(1)}%</span>
          </div>

          {gameState.finished && (
            <div className="race-finished-actions">
              <button type="button" onClick={resetGame} className="btn-reset">
                ダービー準備画面に戻る
              </button>
            </div>
          )}
        </section>
      )}

      {isResultPopupOpen && (
        <div className="derby-result-modal-backdrop" role="presentation" onClick={() => setIsResultPopupOpen(false)}>
          <section
            className="derby-result-modal"
            role="dialog"
            aria-modal="true"
            aria-label="レース結果"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>レース結果</h3>
            <div className="derby-result-layout">
              <div className="derby-result-left">
                <div className="derby-ticket-grid">
                  <div className="derby-ticket-row">
                    <span className="derby-ticket-label">単勝</span>
                    <div className="derby-ticket-value">
                      {winHorse ? renderTicketSquares([winHorse]) : <span className="derby-ticket-empty">-</span>}
                      <span className="derby-ticket-summary">{winHorse ? `1着: ${winHorse.name}` : '-'}</span>
                    </div>
                  </div>
                  <div className="derby-ticket-row">
                    <span className="derby-ticket-label">複勝</span>
                    <div className="derby-ticket-value">
                      {renderTicketSquares(placeHorses)}
                      <span className="derby-ticket-summary">
                        {placeHorses.length > 0
                          ? placeHorses.map((item, idx) => `${idx + 1}着 ${item.name}`).join(' / ')
                          : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="derby-ticket-row">
                    <span className="derby-ticket-label">3連単</span>
                    <div className="derby-ticket-value">
                      {trifectaHorses.length === 3
                        ? renderTicketSquares(trifectaHorses)
                        : <span className="derby-ticket-empty">-</span>}
                      <span className="derby-ticket-summary">
                        {trifectaHorses.length === 3
                          ? `${trifectaHorses[0].name} → ${trifectaHorses[1].name} → ${trifectaHorses[2].name}`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="derby-result-right">
                <h4>最終順位（4着〜10着）</h4>
                <ol className="final-ranking">
                  {visibleRanking.slice(3).map((item, index) => {
                    const rank = index + 3;
                    const runnerColor = getRunnerColor(item.index, item.name);
                    const horseNameColor = runnerColor.text === '#ffffff'
                      ? runnerColor.fill
                      : '#0f172a';
                    return (
                      <li key={item.index} style={{ borderLeftColor: runnerColor.fill }}>
                        <div className="result-main">
                          <span className="result-rank-label">{rank + 1}着</span>
                          <span className="result-separator">:</span>
                          <span
                            className="result-number-chip"
                            style={{ background: runnerColor.fill, color: runnerColor.text }}
                          >
                            {item.index + 1}
                          </span>
                          <span className="result-name" style={{ color: horseNameColor }}>{item.name}</span>
                        </div>
                        <span className="result-value">{item.value.toLocaleString()}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            <div className="derby-result-actions">
              <button type="button" onClick={() => setIsResultPopupOpen(false)} className="btn-reset">
                閉じる
              </button>
              <button type="button" onClick={resetGame} className="btn-reset">
                ダービー準備画面に戻る
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="game-divider" />
      <section className="game-memo" aria-label="Inspiration and credit">
        <h2>Inspiration / Credit</h2>
        <div className="game-memo-item">
          <span className="game-memo-label">Idea</span>
          <span>QuizKnock 動画</span>
        </div>
        <div className="game-memo-item">
          <span className="game-memo-label">Title</span>
          <span>【実質クイズ】クイズ王はデータで競馬をします【YouTubeで見るアレ】</span>
        </div>
        <div className="game-memo-item">
          <span className="game-memo-label">Source</span>
          <a href="https://www.youtube.com/watch?v=xXWHDUomulU" target="_blank" rel="noreferrer">https://www.youtube.com/watch?v=xXWHDUomulU</a>
        </div>
        <div className="game-memo-item">
          <span className="game-memo-label">Built with</span>
          <span>GitHub Copilot</span>
        </div>
      </section>

      <Link to="/" className="back-link">
        ← ホームへ戻る
      </Link>
    </main>
  );
}
