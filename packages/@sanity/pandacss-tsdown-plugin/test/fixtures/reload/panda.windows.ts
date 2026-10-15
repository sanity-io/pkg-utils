// Copied over `panda.config.ts` by the test of Windows absolute globs, written with the
// backslashes `path.resolve()` produces on Windows
import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['C:\\work\\lib\\src\\**\\*.ts', '!C:\\work\\lib\\src\\drafts\\**'],
  exclude: ['\\\\server\\share\\lib\\**'],
  outdir: 'styled-system',
} satisfies Config)
