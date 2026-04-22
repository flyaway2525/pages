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
