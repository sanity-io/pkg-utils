/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK).
 */
import type {FileScope} from '@vanilla-extract/css'

/** @internal */
export function stringifyFileScope({packageName, filePath}: FileScope): string {
  return packageName ? `${filePath}$$$${packageName}` : filePath
}

/** @internal */
export function parseFileScope(serialisedFileScope: string): FileScope {
  const [filePath = '', packageName] = serialisedFileScope.split('$$$')

  return {
    filePath,
    ...(packageName === undefined ? {} : {packageName}),
  }
}
