# pages

React + Vite で構築した、GitHub Pages 公開用の静的サイトです。

このプロジェクトは「グローバル Node.js に依存しない」運用を前提にしており、`setup.bat` を使ってプロジェクト内にローカル Node.js を準備して開発・ビルドを行います。

## このプロジェクトの用途

- GitHub Pages で公開するフロントエンドサイトを作る
- React + TypeScript + Vite で高速に開発する
- 開発環境の差異を減らす（ローカル Node.js をプロジェクト内に固定）

## クイックスタート

プロジェクトルートで以下を実行します。

```bat
setup.bat
```

セットアップ後、開発サーバーを起動します。

```bat
setup.bat dev
```

アクセス先:

- 開発: http://localhost:5173/pages/

## 主要コマンド

```bat
setup.bat            # 初期セットアップ（Node.js ローカル導入 + npm install）
setup.bat install    # 上と同じ
setup.bat dev        # 開発サーバー起動
setup.bat build      # 本番ビルド（dist/ を生成）
setup.bat preview    # 本番ビルド結果をローカルサーバーで確認
setup.bat npm <args> # ローカル Node.js 上で npm コマンド実行
```

補足:

- `setup.bat preview` は `dist/` が必要です
- `dist/` がない場合は先に `setup.bat build` を実行してください

## VS Code タスクでの開発方法

`.vscode/tasks.json` にタスク定義済みです。コマンドパレットから `Tasks: Run Task` を開いて実行できます。

- `Setup Local Environment`: 初期セットアップ
- `Start Development Server`: 開発サーバー起動
- `Build for Production`: 本番ビルド
- `Preview Production Build`: 本番ビルドを起動して確認

`Preview Production Build` は `Build for Production` に依存しているため、プレビュー実行時に先にビルドされます。

## プロジェクト構成

```text
pages/
	.vscode/
		settings.json      # ワークスペース用ターミナル設定
		tasks.json         # ビルド/起動タスク
	src/
		main.tsx           # エントリポイント
		App.tsx            # 画面ルートコンポーネント
		index.css          # グローバルスタイル
		App.css            # App用スタイル
	index.html           # HTML テンプレート
	setup.bat            # ローカル Node.js 管理と各種コマンド入口
	vite.config.ts       # Vite 設定（base を含む）
	package.json         # npm scripts と依存関係
	tsconfig.json        # TypeScript 設定
```

## 開発時のルール（運用）

- グローバル Node.js のインストールは不要
- ローカル Node.js は `.tools/node/current` に配置
- npm キャッシュは `.cache` に配置
- `node_modules` はプロジェクト配下に配置

## GitHub Pages デプロイ

- `main` ブランチに push
- GitHub Actions が自動でビルド
- `dist/` を GitHub Pages へデプロイ

初回のみ、GitHub リポジトリの Settings > Pages > Source を `GitHub Actions` に設定してください。

## Vite base 設定について

`vite.config.ts` の `base: '/pages/'` はリポジトリ名に合わせた設定です。

- リポジトリ名を変更した場合は `base` も合わせて変更してください
- 例: リポジトリ名が `my-site` の場合は `base: '/my-site/'`

## ページ一覧

### Word Game (`/word-game`)

しりとりスプラトゥーン。

- しりとりの要領で単語をつないでいくゲーム
- 入力した単語の長さ・希少度などに応じてスコアが変動する

### データダービー (`/data-derby`)

バーチャートレースの着順を予想するゲーム。

- CSV データを読み込んでバーチャートレースをアニメーション再生
- レース開始前に着順を予想し、結果に応じてスコアを算出
- サンプルデータ (`public/sample-data/`) をそのまま利用可能
- 独自 CSV をアップロードしてプレイすることも可能

### 絵画クレーンゲーム (`/art-crane-game`)

記憶頼りに絵画でクレーンゲーム。

**ゲームの流れ（3ステップ）**

1. **STEP1 – 問題設定**: 例題4問から選ぶか、独自画像をアップロードして出題内容を作る
2. **STEP2 – プレイ**: 絵画の一部を隠した状態でクレーンを操作し、答えの位置を指定する
   - 右ボタン長押し → 離す → 上ボタン長押し → 離す の順番で操作
   - 離した時点でクレーンが止まる
3. **STEP3 – 結果**: 全体画像が公開され、スコアと正解位置を確認する

**主な機能**

| 機能 | 内容 |
|---|---|
| 例題4問 | フェルメール・葛飾北斎・ゴッホ・モネの名画 |
| 独自問題 | 画像アップロード＋問題文＋正解座標をクリックで設定 |
| カスタム問題保存 | localStorage に保存、リスト表示・削除・再プレイ可能 |
| 結果ポップアップ | 2秒後に出現、パネル外タップで非表示・再表示切り替え |
| デバッグ座標表示 | 結果画面で画像をクリックすると正規化座標 (0〜1) を表示 |

**例題の正解座標を調整する方法**

1. 例題でプレイしてリザルト画面へ進む
2. 正解にしたい位置をクリック → 座標ラベル (`x: 0.XX, y: 0.XX`) が表示される
3. [src/pages/ArtCraneGame.tsx](src/pages/ArtCraneGame.tsx) の `SAMPLE_QUESTIONS` 内 `targetPoint` を書き換える

### About / Works / Blog / Contact

現時点では静的なプレースホルダーページです。

