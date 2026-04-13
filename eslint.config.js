import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const baseRules = {
  // Correctness only — no style rules (Prettier handles formatting)
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-explicit-any': 'warn',
  'no-constant-condition': 'error',
  'no-debugger': 'error',
  'no-duplicate-case': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-extra-boolean-cast': 'error',
  'no-unreachable': 'error',
  'prefer-const': 'error',
  'no-var': 'error',
};

export default [
  {
    ignores: ['**/dist/', '**/node_modules/', '*.config.*'],
  },
  // Source files — type-aware rules enabled via projectService
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/src/**/*.tsx'],
    ignores: ['packages/*/src/__tests__/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...baseRules,
      '@typescript-eslint/no-unnecessary-condition': 'warn',
    },
  },
  // Test files — basic rules only (excluded from tsconfig, no type info available)
  {
    files: ['packages/*/src/__tests__/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: baseRules,
  },
];
