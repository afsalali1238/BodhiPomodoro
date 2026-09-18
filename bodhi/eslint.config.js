import js from '@eslint/js';
import ts from 'typescript-eslint';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import svelteConfig from './svelte.config.js';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: tsParser, svelteConfig }
    },
    // Compiler warnings (and their svelte-ignore comments) are owned by
    // svelte-check; ESLint can't see them, so this rule only false-positives.
    rules: {
      'svelte/no-unused-svelte-ignore': 'off'
    }
  },
  {
    ignores: ['dist/', 'src-tauri/target/', 'src-tauri/gen/', 'node_modules/']
  }
];
