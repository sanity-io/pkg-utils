/**
 * Replaces the `eval` package used by upstream `@vanilla-extract/integration` with Node's own
 * CommonJS-wrapper primitives: `vm.compileFunction` compiles the source with the standard
 * module parameters (plus the caller's scope variables), and `module.createRequire` resolves
 * `require()` calls from the evaluated file's real location — so the module sees the same
 * `@vanilla-extract/*` instances the project resolves.
 */
import {createRequire} from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

/** @internal */
export function evalModule(
  source: string,
  filePath: string,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  const scopeKeys = Object.keys(scope)
  const compiled = vm.compileFunction(
    source,
    ['exports', 'require', 'module', '__filename', '__dirname', ...scopeKeys],
    {filename: filePath},
  )

  const module = {exports: {} as Record<string, unknown>}
  const require = createRequire(filePath)

  compiled(
    module.exports,
    require,
    module,
    filePath,
    path.dirname(filePath),
    ...scopeKeys.map((key) => scope[key]),
  )

  return module.exports
}
