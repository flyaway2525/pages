import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// リポジトリ名に合わせて base を設定する（GitHub Pages のサブパス対応）
export default defineConfig({
  plugins: [react()],
  base: '/pages/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
});
