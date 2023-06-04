'use strict'

/** @type import('eslint').Linter.Config */
module.exports = {
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  plugins: ['import', 'simple-import-sort', 'prettier'],
  rules: {
    'no-console': 'error',
    'no-shadow': 'error',
    'no-warning-comments': ['warn', {location: 'start', terms: ['todo', 'fixme']}],
    'padding-line-between-statements': [
      'warn',
      {blankLine: 'always', prev: '*', next: 'block'},
      {blankLine: 'always', prev: '*', next: 'block-like'},
      {blankLine: 'always', prev: 'const', next: 'expression'},
      {blankLine: 'always', prev: 'let', next: 'expression'},
      {blankLine: 'always', prev: 'var', next: 'expression'},
      {blankLine: 'always', prev: 'block', next: '*'},
      {blankLine: 'always', prev: 'block-like', next: '*'},
      {blankLine: 'always', prev: '*', next: 'return'},
    ],
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:prettier/recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      plugins: ['import', '@typescript-eslint', 'simple-import-sort', 'prettier'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'error',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/member-delimiter-style': 'off',
        '@typescript-eslint/no-empty-interface': 'off',
      },
    },
  ],
}
