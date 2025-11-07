import {defineConfig, type PkgConfigProperty} from '@sanity/pkg-utils'
import {expectTypeOf, test} from 'vitest'

test('it narrows the type of the config object', () => {
  const config1 = defineConfig({external: ['react']})

  expectTypeOf(config1.external[0]).toEqualTypeOf<'react'>()

  const config2 = defineConfig({external: (prev) => prev.filter((pkg) => pkg !== 'react')})

  expectTypeOf(config2.external).toEqualTypeOf<(prev: string[]) => string[]>()

  const config3 = defineConfig({})

  expectTypeOf(config3).not.toEqualTypeOf<{external?: PkgConfigProperty<string[]>}>()
})
