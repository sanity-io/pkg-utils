import {_loadConfig, _loadPkgWithReporting} from './_core'
import {_printPackageTree} from './_printPackageTree'
import {_resolveBuildContext} from './_resolveBuildContext'

/** @public */
export async function check(options: {cwd: string; tsconfig?: string}): Promise<void> {
  const {cwd, tsconfig = 'tsconfig.json'} = options

  const pkg = await _loadPkgWithReporting({cwd})
  const config = await _loadConfig({cwd})
  const ctx = await _resolveBuildContext({config, cwd, pkg, tsconfig})

  _printPackageTree(ctx)
}
