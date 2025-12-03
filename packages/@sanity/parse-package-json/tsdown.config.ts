import {defineConfig} from 'tsdown'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  publint: true,
  inputOptions: {experimental: {attachDebugInfo: 'none'}},
  exports: {enabled: 'local-only', devExports: true},
})
