import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'

export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly'
      }
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: tsParser, extraFileExtensions: ['.svelte'] }
    },
    rules: {
      // New in eslint-plugin-svelte 3; the Set/Map uses here are local or
      // deliberately non-reactive, so SvelteSet/SvelteMap would add overhead.
      'svelte/prefer-svelte-reactivity': 'off'
    }
  }
]
