/**
 * Log level for a TSDoc / API Extractor rule.
 * @public
 */
export type PackageTsdocRuleLevel = 'error' | 'warn' | 'info' | 'off'

/**
 * A custom TSDoc tag definition, forwarded to `@microsoft/tsdoc-config`.
 * @public
 */
export interface PackageTsdocCustomTag {
  name: string
  syntaxKind: 'block' | 'modifier'
  allowMultiple?: boolean
}

/**
 * Options for the `tsdoc` option: the `@microsoft/api-extractor` powered TSDoc and release-tag
 * checking that runs after the build (via tsdown's `build:done` hook).
 * @public
 */
export interface PackageTsdocOptions {
  /**
   * Packages whose types should be treated as part of this project (API Extractor's
   * `bundledPackages`). Usually inferred from `deps.alwaysBundle` string entries; pass
   * explicitly when the check needs a richer list (e.g. non-external `devDependencies`).
   */
  bundledPackages?: string[]
  customTags?: PackageTsdocCustomTag[]
  rules?: {
    'ae-incompatible-release-tags'?: PackageTsdocRuleLevel
    'ae-internal-missing-underscore'?: PackageTsdocRuleLevel
    'ae-missing-release-tag'?: PackageTsdocRuleLevel
    'tsdoc-link-tag-unescaped-text'?: PackageTsdocRuleLevel
    'tsdoc-undefined-tag'?: PackageTsdocRuleLevel
    'tsdoc-unsupported-tag'?: PackageTsdocRuleLevel
  }
}
