import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/adaptkit/' : '/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@adaptkit/core', replacement: path.resolve(__dirname, '../packages/core/src/index.ts') },
      { find: '@adaptkit/react', replacement: path.resolve(__dirname, '../packages/react/src/index.tsx') },
    ],
  },
}));
