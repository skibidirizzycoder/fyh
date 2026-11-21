// eslint.config.js — lint rules (flat config + typescript-eslint).
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'dist-test/', 'artifacts/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    rules: {
      // Counts inner helpers too, so factory functions (createX) get room; split anything longer.
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
      'no-console': ['error', { allow: ['log', 'error'] }],
      // Unused arguments are fine when their name starts with _ (e.g. in fakes).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
