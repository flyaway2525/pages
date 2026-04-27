import { useEffect, useState } from 'react';
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
  isRunning: boolean;
  finished: boolean;
}

export default function DataDerby() {
  const [gameState, setGameState] = useState<GameState>({
    items: [],
    axisTitle: 'date',
    timeLabels: [],
    currentTimepoint: 0,
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
  const showManualItemInput = false;

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
      return { error: '2項目以上に対して、2時点以上の数値が必要です。' };
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

  const startRace = () => {
    if (gameState.items.length === 0) return;

    setGameState((prev) => {
      const maxTimepoint = Math.max(
        ...prev.items.map((item) => item.values.length - 1)
      );

      const newState = {
        ...prev,
        currentTimepoint: 0,
        isRunning: true,
        finished: false,
      };

      // アニメーション開始
      setTimeout(() => animateRaceWithMaxTimepoint(maxTimepoint), 0);

      return newState;
    });
  };

  const animateRaceWithMaxTimepoint = (maxTimepoint: number) => {
    let timepoint = 0;

    const interval = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        currentTimepoint: timepoint,
      }));

      if (timepoint >= maxTimepoint) {
        clearInterval(interval);
        setGameState((prev) => ({
          ...prev,
          isRunning: false,
          finished: true,
        }));
        return;
      }

      timepoint++;
    }, 500);
  };

  const resetGame = () => {
    setGameState({
      items: [],
      axisTitle: 'date',
      timeLabels: [],
      currentTimepoint: 0,
      isRunning: false,
      finished: false,
    });
    setFormData({ itemName: '', values: '' });
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
      isRunning: false,
      finished: false,
    }));
    setTableError('');
  };

  const importTableData = () => {
    syncTableTextToItems(tableText, true);
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
      setChartTitle('YOASOBI Billboard Japan（月別ストリーミング再生回数）');
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
      setChartTitle('青空文庫のアクセス数ランキング（2009-2022 累計）');
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
      setChartTitle('夏季オリンピックの国別メダル総獲得数ランキング（1908-2024）');
      setTableError('');
    } catch {
      setTableError('夏季オリンピックCSVの読み込みに失敗しました。');
    } finally {
      setIsLoadingCsvSample(false);
    }
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

    // 列ごとに数値配列を収集（0列目は軸なので1列目以降）
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

  // 現在の時点でのランキングを計算
  const getCurrentRanking = () => {
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
  };

  const currentRanking = getCurrentRanking();
  const maxValue = Math.max(
    ...currentRanking.map((r) => r.value),
    1
  );
  const tablePreview = buildTablePreview();

  return (
    <main className="page data-derby-page">
      <h1>データダービー</h1>
      <p>バーチャートレースの着順を予想するツールです。</p>

      {!gameState.isRunning && !gameState.finished && (
        <section className="derby-input-section">
          <h2>ステップ1: データを入力</h2>
          <div className="input-form">
            {showManualItemInput && (
              <>
                <div className="form-group">
                  <label>項目名（出走馬）</label>
                  <input
                    type="text"
                    placeholder="例: アイドル"
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
                    placeholder="例: 100,200,350,500"
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
                placeholder="例: 都道府県の人口ランキング"
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
              <button
                type="button"
                onClick={loadCsvSampleToTextarea}
                className="btn-sample"
                disabled={isLoadingCsvSample}
              >
                {isLoadingCsvSample ? '読み込み中...' : '日本人口CSVを入力欄へ'}
              </button>
              <button
                type="button"
                onClick={loadYoaosobi}
                className="btn-sample"
                disabled={isLoadingCsvSample}
              >
                {isLoadingCsvSample ? '読み込み中...' : 'YOASOBIを入力欄へ'}
              </button>
              <button
                type="button"
                onClick={loadAozoraRanking}
                className="btn-sample"
                disabled={isLoadingCsvSample}
              >
                {isLoadingCsvSample ? '読み込み中...' : '青空文庫CSVを入力欄へ'}
              </button>
              <button
                type="button"
                onClick={loadSummerOlympicsRanking}
                className="btn-sample"
                disabled={isLoadingCsvSample}
              >
                {isLoadingCsvSample ? '読み込み中...' : '夏季オリンピックCSVを入力欄へ'}
              </button>
            </div>

            <section className="table-import-panel">
              <div className="table-import-head">
                <div>
                  <h3>表形式でまとめて貼り付け</h3>
                  <p>1列目をdate、2列目以降を項目名にした CSV / TSV をそのまま貼れます。編集中は反映されず、「表データを取り込む」で更新されます。</p>
                </div>
                <button type="button" className="btn-import-table" onClick={importTableData}>
                  表データを取り込む
                </button>
              </div>
              <textarea
                className="table-import-textarea"
                value={tableText}
                onChange={(e) => handleTableTextChange(e.target.value)}
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
                    プレビュー（{tablePreview.totalRows}行 / {tablePreview.totalColumns}列）
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
                          {row.map((cell, cellIndex) => (
                            <td
                              key={`preview-cell-${rowIndex}-${cellIndex}`}
                              className={cell.isMissing ? 'pivot-cell-missing' : undefined}
                              title={cell.isMissing ? `補完値: ${cell.display}` : undefined}
                            >
                              {cell.display}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(tablePreview.totalRows > tablePreview.rows.length ||
                    tablePreview.totalColumns > tablePreview.header.length) && (
                    <p className="table-preview-note">表示を軽くするため先頭の一部のみ表示しています。</p>
                  )}
                </div>
              )}
              {tableError && <p className="table-import-error">{tableError}</p>}
            </section>
          </div>

          {gameState.items.length > 0 && (
            <>
              <button onClick={startRace} className="btn-start-race">
                レース開始！
              </button>
            </>
          )}
        </section>
      )}

      {(gameState.isRunning || gameState.finished) && (
        <section className="derby-race-section">
          <h2>ステップ2: バーチャートレース</h2>
          {chartTitle.trim() && <p className="derby-chart-title">{chartTitle}</p>}

          <div className="race-container">
            <div className="bar-chart">
              {currentRanking.map((item, rank) => (
                <div key={item.index} className="bar-row">
                  <div className="rank-badge">#{rank + 1}</div>
                  <div className="bar-label">{item.name}</div>
                  <div className="bar-bg">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(item.value / maxValue) * 100}%`,
                        transition: gameState.isRunning
                          ? 'width 0.4s ease'
                          : 'none',
                      }}
                    />
                  </div>
                  <div className="bar-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {gameState.isRunning && (
            <p className="race-info">
              {gameState.axisTitle || 'date'}: {gameState.timeLabels[gameState.currentTimepoint] || `${gameState.axisTitle || 'date'}${gameState.currentTimepoint + 1}`} ({gameState.currentTimepoint + 1} /{' '}
              {Math.max(...gameState.items.map((item) => item.values.length))})
            </p>
          )}

          {gameState.finished && (
            <section className="derby-result-section">
              <h3>最終結果</h3>
              <ol className="final-ranking">
                {currentRanking.map((item) => (
                  <li key={item.index}>
                    <span className="result-name">{item.name}</span>
                    <span className="result-value">{item.value}</span>
                  </li>
                ))}
              </ol>

              <button onClick={resetGame} className="btn-reset">
                リセット
              </button>
            </section>
          )}
        </section>
      )}

      <Link to="/" className="back-link">
        ← ホームへ戻る
      </Link>
    </main>
  );
}
