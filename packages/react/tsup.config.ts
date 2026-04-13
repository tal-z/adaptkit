import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  minify: true,
  treeshake: true,
  external: ['react', '@adaptkit/core'],
});
