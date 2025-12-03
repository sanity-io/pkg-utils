import {defineConfig} from 'tsdown'


export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  publint: true,
  // format: options.format ?? 'esm',
  inputOptions: {experimental: {attachDebugInfo: 'none'}},
  exports: {
    enabled: 'local-only',
    devExports: 'source',
  },
})
