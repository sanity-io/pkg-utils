import type {ExtractorResult} from '@microsoft/api-extractor'
import * as prettier from 'prettier'
import ts from 'typescript'
import {expect, test} from 'vitest'
import {extractModuleBlocksFromTypes} from '../src/node/tasks/dts/extractModuleBlocks'

/**
 * Create a mock ExtractorResult with the given source files.
 * Only mocks the parts used by extractModuleBlocksFromTypes.
 */
function createMockExtractorResult(files: Record<string, string>): ExtractorResult {
  const sourceFiles = Object.entries(files).map(([fileName, text]) =>
    ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true),
  )

  return {
    compilerState: {
      program: {
        getSourceFiles: () => sourceFiles,
      },
    },
  } as ExtractorResult
}

/**
 * Format TypeScript code with prettier (same as extractTypes.ts does)
 */
async function format(code: string): Promise<string> {
  return prettier.format(code, {parser: 'typescript'})
}

test('extract module blocks from types', async () => {
  const extractResult = createMockExtractorResult({
    './virtual/test.d.ts': `
    interface A {}

    declare module X {
      /**
       * @beta
       **/
      interface A {
          a: string
      }
    }

      /** @public */
      declare module TT {
        /** @public */
        interface X {
            x: string
        }
      }

      declare module YY {
        /** @internal */
        interface Y {
            y: string
        }
      }

      const a = 0; /*declare module 'sanity' {}*/ const b = 0;
/*declare module 'sanity' {}*/
      /* declare module 'sanity' {} */

       /**
       * declare module 'sanity' {
       *  export interface StringOptions {
       *    myCustomOption?: boolean
       *  }
       * }
       * /

 /*
     declare module 'BB' {
      export interface BB {
        a: string
      }
     }
        */
  `,
  })

  const blocks = extractModuleBlocksFromTypes({
    tsOutDir: 'virtual',
    extractResult,
  })

  expect(blocks.length).toEqual(3)

  expect(await format(blocks[0]!)).toEqual(
    await format(`
    declare module X {
      /**
       * @beta
       **/
      interface A {
          a: string
      }
    }`),
  )

  expect(await format(blocks[1]!)).toEqual(
    await format(`
    /** @public */
    declare module TT {
      /** @public */
      interface X {
          x: string
      }
    }`),
  )

  expect(await format(blocks[2]!)).toEqual(
    await format(`
    declare module YY {
      /** @internal */
      interface Y {
          y: string
      }
    }`),
  )
})

test('filters files by tsOutDir', async () => {
  const extractResult = createMockExtractorResult({
    './virtual/included.d.ts': 'declare module Included { interface A {} }',
    './other/excluded.d.ts': 'declare module Excluded { interface B {} }',
  })

  const blocks = extractModuleBlocksFromTypes({
    tsOutDir: 'virtual',
    extractResult,
  })

  expect(blocks.length).toEqual(1)
  expect(await format(blocks[0]!)).toContain('declare module Included')
})

test('skips files without declare module', async () => {
  const extractResult = createMockExtractorResult({
    './virtual/no-modules.d.ts': 'interface A { a: string }',
    './virtual/has-modules.d.ts': 'declare module Test { interface B {} }',
  })

  const blocks = extractModuleBlocksFromTypes({
    tsOutDir: 'virtual',
    extractResult,
  })

  expect(blocks.length).toEqual(1)
  expect(await format(blocks[0]!)).toContain('declare module Test')
})

test('extracts module blocks with string literal names', async () => {
  const extractResult = createMockExtractorResult({
    './virtual/module.d.ts': `
      export interface Foo {}

      declare module './other' {
        interface ExtendedFoo {
          extra: string
        }
      }

      declare module "sanity" {
        interface SanityExtension {
          custom: boolean
        }
      }
    `,
  })

  const blocks = extractModuleBlocksFromTypes({
    tsOutDir: 'virtual',
    extractResult,
  })

  expect(blocks.length).toEqual(2)
  expect(await format(blocks[0]!)).toEqual(
    await format(`
    declare module './other' {
      interface ExtendedFoo {
        extra: string
      }
    }`),
  )
  expect(await format(blocks[1]!)).toEqual(
    await format(`
    declare module "sanity" {
      interface SanityExtension {
        custom: boolean
      }
    }`),
  )
})
