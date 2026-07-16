/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * `dedent` dependency replaced by plain string building and `mlly`'s `detectSyntax` vendored
 * into {@link detectSyntax}.
 */
import path from 'node:path'
import {detectSyntax} from './detectSyntax.ts'
import {normalizePath} from './normalizePath.ts'

/** @public */
export interface AddFileScopeParams {
  source: string
  filePath: string
  rootPath: string
  packageName: string
  globalAdapterIdentifier?: string
}

/**
 * Wraps a `.css.ts` module's source with `setFileScope`/`endFileScope` calls (rewriting the
 * arguments of an existing `setFileScope` call instead, when present), and optionally binds a
 * global adapter around the module body.
 * @public
 */
export function addFileScope({
  source,
  filePath,
  rootPath,
  packageName,
  globalAdapterIdentifier,
}: AddFileScopeParams): string {
  // Encode windows file paths as posix
  const normalizedPath = normalizePath(path.relative(rootPath, filePath))
  const {hasESM, isMixed} = detectSyntax(source)

  // Keying on the module specifier (not on a `setFileScope(` call) is deliberate, matching
  // upstream: a source that already imports the fileScope module cannot be wrapped again — the
  // injected `import { setFileScope, endFileScope }` would duplicate its bindings and turn the
  // module into a syntax error. An import without a call is out of contract and passes through.
  if (source.includes('@vanilla-extract/css/fileScope')) {
    source = source.replace(
      /setFileScope\(((\n|.)*?)\)/,
      `setFileScope("${normalizedPath}", "${packageName}")`,
    )
  } else if (hasESM && !isMixed) {
    source = [
      `import { setFileScope, endFileScope } from "@vanilla-extract/css/fileScope";`,
      `setFileScope("${normalizedPath}", "${packageName}");`,
      source,
      `endFileScope();`,
    ].join('\n')
  } else {
    source = [
      `const __vanilla_filescope__ = require("@vanilla-extract/css/fileScope");`,
      `__vanilla_filescope__.setFileScope("${normalizedPath}", "${packageName}");`,
      source,
      `__vanilla_filescope__.endFileScope();`,
    ].join('\n')
  }

  if (globalAdapterIdentifier) {
    const adapterImport =
      hasESM && !isMixed
        ? 'import * as __vanilla_css_adapter__ from "@vanilla-extract/css/adapter";'
        : 'const __vanilla_css_adapter__ = require("@vanilla-extract/css/adapter");'

    source = [
      adapterImport,
      `__vanilla_css_adapter__.setAdapter(${globalAdapterIdentifier});`,
      source,
      `__vanilla_css_adapter__.removeAdapter();`,
    ].join('\n')
  }

  return source
}
