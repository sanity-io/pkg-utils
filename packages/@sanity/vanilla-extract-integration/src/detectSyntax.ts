/**
 * The ESM/CJS syntax detection of `mlly` (MIT licensed, Copyright (c) Pooya Parsa), vendored so
 * the single `detectSyntax` call in {@link addFileScope} doesn't pull in the whole `mlly`
 * subtree (`acorn`, `pathe`, `pkg-types`, `ufo`).
 * https://github.com/unjs/mlly/blob/main/src/syntax.ts
 */

const ESM_RE =
  /(?:[\s;]|^)(?:import[\s\w*,{}]*from|import\s*["'*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m

const CJS_RE = /(?:[\s;]|^)(?:module\.exports\b|exports\.\w|require\s*\(|global\.\w)/m

/** @internal */
export function detectSyntax(code: string): {hasESM: boolean; hasCJS: boolean; isMixed: boolean} {
  const hasESM = ESM_RE.test(code)
  const hasCJS = CJS_RE.test(code)

  return {
    hasESM,
    hasCJS,
    isMixed: hasESM && hasCJS,
  }
}
