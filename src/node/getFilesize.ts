import {statSync} from 'fs'
import prettyBytes from 'pretty-bytes'

export function getFilesize(file: string): string {
  const stats = statSync(file)

  return prettyBytes(stats.size)
}
