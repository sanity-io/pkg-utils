/**
 * Programmatic TSDoc / release-tag checking. Import from `@sanity/tsdown-config/tsdoc`
 * (not the package root) so API Extractor and related dependencies are only loaded when
 * this entry is used.
 * @module
 */

export {
  checkTsdoc,
  type CheckTsdocLogger,
  type CheckTsdocOptions,
  type CheckTsdocResult,
} from './checkTsdoc.ts'
export type {
  PackageTsdocCustomTag,
  PackageTsdocOptions,
  PackageTsdocRuleLevel,
} from './types.ts'
