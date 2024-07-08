/* eslint-disable no-console */
import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  reactCompilerOptions: {
    panicThreshold: 'ALL_ERRORS',
    logger: {
      logEvent(filename, event) {
        if (event.kind === 'CompileError') {
          console.group(`[${filename}] ${event.kind}`)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const {reason, description, severity, loc, suggestions} = event.detail as any

          console.error(`[${severity}] ${reason}`)
          console.log(`${filename}:${loc.start.line}:${loc.start.column} ${description}`)

          for (const suggestion of suggestions) {
            console.log(suggestion.description)
          }

          console.groupEnd()
        }
      },
    },
  },
})
