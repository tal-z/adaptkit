import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    minify: true,
    treeshake: true,
  },
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'AdaptKit',
    outDir: 'dist',
    outExtension: () => ({ js: '.global.js' }),
    minify: true,
    sourcemap: true,
  },
]);
