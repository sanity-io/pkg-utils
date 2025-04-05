import fs from 'node:fs/promises'
import path from 'node:path'

import type {BuildContext} from '../../core'

export async function buildTemporaryImportsPackageJson(
  ctx: Pick<BuildContext, 'pkg'>,
  tmpPath: string,
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(ctx, tmpPath)
  // eslint-disable-next-line no-debugger
  debugger

  const {imports} = ctx.pkg

  await fs.writeFile(path.join(tmpPath, 'package.json'), JSON.stringify({imports}, null, 2))
  // eslint-disable-next-line no-debugger
  debugger
}
