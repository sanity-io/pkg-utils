import {_loadPkgWithReporting} from '../core'

export async function check(options: {cwd: string}): Promise<void> {
  await _loadPkgWithReporting(options)
}
