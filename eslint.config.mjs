import _import from 'eslint-plugin-import'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import prettier from 'eslint-plugin-prettier'
import {fixupPluginRules} from '@eslint/compat'
import globals from 'globals'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import js from '@eslint/js'
import {FlatCompat} from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

export default [
  {
    ignores: [
      'dist',
      'playground/*/.next',
      'playground/*/dist',
      'playground/*/lib',
      'test/env/__tmp__',
    ],
  },
  ...compat.extends('eslint:recommended', 'plugin:prettier/recommended'),
  {
    plugins: {
      'import': fixupPluginRules(_import),
      'simple-import-sort': simpleImportSort,
      prettier,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },

      ecmaVersion: 2020,
      sourceType: 'module',
    },

    rules: {
      'no-console': 'error',
      'no-shadow': 'error',

      'no-warning-comments': [
        'warn',
        {
          location: 'start',
          terms: ['todo', 'fixme'],
        },
      ],

      'padding-line-between-statements': [
        'warn',
        {
          blankLine: 'always',
          prev: '*',
          next: 'block',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'block-like',
        },
        {
          blankLine: 'always',
          prev: 'const',
          next: 'expression',
        },
        {
          blankLine: 'always',
          prev: 'let',
          next: 'expression',
        },
        {
          blankLine: 'always',
          prev: 'var',
          next: 'expression',
        },
        {
          blankLine: 'always',
          prev: 'block',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: 'block-like',
          next: '*',
        },
        {
          blankLine: 'always',
          prev: '*',
          next: 'return',
        },
      ],

      'quote-props': ['warn', 'consistent'],
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
  ...compat
    .extends(
      'eslint:recommended',
      'plugin:prettier/recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
    )
    .map((config) => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx'],
    })),
  {
    files: ['**/*.ts', '**/*.tsx'],

    plugins: {
      'import': fixupPluginRules(_import),
      '@typescript-eslint': typescriptEslint,
      'simple-import-sort': simpleImportSort,
      prettier,
    },

    languageOptions: {
      parser: tsParser,
    },

    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/member-delimiter-style': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
]
