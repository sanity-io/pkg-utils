/**
 * Ported from `@vanilla-extract/css` (MIT licensed, Copyright (c) 2021 SEEK): the object helpers
 * of `packages/css/src/utils.ts` that the renderer uses, plus `getVarName` from
 * `@vanilla-extract/private` (same license), inlined so the renderer has no dependency on that
 * private package.
 */

/**
 * Style objects are plain records at runtime; the `@vanilla-extract/css` interface types just
 * lack the index signature to say so.
 */
export function toRecord(value: object): Record<string, unknown> {
  // oxlint-disable-next-line no-unsafe-type-assertion
  return value as Record<string, unknown>
}

export function forEach(obj: object | undefined, fn: (value: unknown, key: string) => void): void {
  if (!obj) return
  for (const [key, value] of Object.entries(toRecord(obj))) {
    fn(value, key)
  }
}

export function omit(
  obj: object | undefined,
  omitKeys: ReadonlyArray<string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (obj) {
    for (const [key, value] of Object.entries(toRecord(obj))) {
      if (!omitKeys.includes(key)) {
        result[key] = value
      }
    }
  }

  return result
}

export function mapKeys(
  obj: object | undefined,
  fn: (value: unknown, key: string) => string,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (obj) {
    for (const [key, value] of Object.entries(toRecord(obj))) {
      result[fn(value, key)] = value
    }
  }

  return result
}

// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
export function escapeRegex(string: string): string {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

/** `var(--foo)` → `--foo`; anything else is returned as-is. */
export function getVarName(variable: string): string {
  const matches = variable.match(/^var\((.*)\)$/)

  if (matches?.[1] !== undefined) {
    return matches[1]
  }

  return variable
}

/** `borderTopColor` → `border-top-color`, `msFlex` → `-ms-flex`. */
export function dashify(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/^ms-/, '-ms-')
    .toLowerCase()
}
