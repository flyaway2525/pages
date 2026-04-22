# pages

React + Vite で構築した GitHub Pages 用静的サイト。

## セットアップ

```bat
setup.bat
```

Node.js はプロジェクト内の `.tools\node\current` にローカルインストールされます。グローバル環境は汚染しません。

## 開発

```bat
setup.bat dev       # 開発サーバー起動 (http://localhost:5173/pages/)
setup.bat build     # 本番ビルド → dist/
setup.bat preview   # ビルド結果をローカルで確認
setup.bat npm ...   # ローカル Node.js で npm コマンドを実行
```

## デプロイ

`main` ブランチに push すると GitHub Actions が自動でビルドし GitHub Pages に公開します。

初回は GitHub リポジトリの Settings → Pages → Source を **GitHub Actions** に設定してください。
