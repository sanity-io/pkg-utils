import pluginBabel from '@rolldown/plugin-babel'
import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  // Custom Babel plugins run through the `plugins` escape hatch with a self-installed
  // `@rolldown/plugin-babel` (the successor of the removed `babel.plugins` option).
  plugins: [
    await pluginBabel({
      plugins: ['@babel/plugin-transform-object-rest-spread'],
    }),
  ],
  tsconfig: 'tsconfig.dist.json',
})
