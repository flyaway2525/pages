# AGENTS.md

## Purpose

React + Vite で構築した GitHub Pages 公開用の静的サイト。

## Local Runtime Rules

- グローバルな Node.js は不要。`setup.bat` でプロジェクト内にローカル Node.js を自動インストールする。
- Node.js は `.tools\node\current` に配置される。
- npm キャッシュは `.cache` に配置される。
- `node_modules` はプロジェクトルートに配置される（グローバルインストール禁止）。

## Standard Commands

- 初期セットアップ: `setup.bat`
- 開発サーバー起動: `setup.bat dev`
- 本番ビルド: `setup.bat build`
- ビルド確認: `setup.bat preview`
- npm コマンド転送: `setup.bat npm <args>`

## GitHub Pages デプロイ

- `main` ブランチ push → GitHub Actions が自動ビルド → `dist/` を GitHub Pages へデプロイ
- ワークフロー: `.github/workflows/deploy.yml`
- 初回のみ GitHub リポジトリ Settings → Pages → Source を **GitHub Actions** に変更すること

## Vite 設定

- `vite.config.ts` の `base: '/pages/'` はリポジトリ名に合わせた設定
- リポジトリ名が変わった場合は `base` の値も変更すること
- ビルド出力先: `dist/`
- 開発サーバー: `http://localhost:5173/pages/`

## VS Code Workflow

- Tasks は `.vscode/tasks.json` に定義済み
- ターミナルはワークスペースローカルの Node.js を優先使用するよう `.vscode/settings.json` で設定済み

## Code Organization Rules

- コンポーネントは `src/components/` に配置する
- ページ単位のコンポーネントは `src/pages/` に配置する
- カスタムフックは `src/hooks/` に配置する
- 1ファイルあたりの目安は 200〜300 行
