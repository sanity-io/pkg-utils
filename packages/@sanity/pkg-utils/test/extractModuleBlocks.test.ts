import {EOL} from 'node:os'
import type {ExtractorResult} from '@microsoft/api-extractor'
import _outdent from 'outdent'
import ts from 'typescript'
import {expect, test} from 'vitest'
import {extractModuleBlocksFromTypes} from '../src/node/tasks/dts/extractModuleBlocks'

const outdent = _outdent({newline: EOL})

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

test('extract module blocks from types', () => {
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

  expect(blocks[0]).toEqual(
    outdent`
    declare module X {
      /**
       * @beta
       **/
      interface A {
          a: string
      }
    }`,
  )

  expect(blocks[1]).toEqual(outdent`
    /** @public */
    declare module TT {
      /** @public */
      interface X {
          x: string
      }
    }`)

  expect(blocks[2]).toEqual(outdent`
    declare module YY {
      /** @internal */
      interface Y {
          y: string
      }
    }`)
})

test('filters files by tsOutDir', () => {
  const extractResult = createMockExtractorResult({
    './virtual/included.d.ts': 'declare module Included { interface A {} }',
    './other/excluded.d.ts': 'declare module Excluded { interface B {} }',
  })

  const blocks = extractModuleBlocksFromTypes({
    tsOutDir: 'virtual',
    extractResult,
  })

  expect(blocks.length).toEqual(1)
  expect(blocks[0]).toContain('declare module Included')
})

test('skips files without declare module', () => {
  const extractResult = createMockExtractorResult({
    './virtual/no-modules.d.ts': 'interface A { a: string }',
    './virtual/has-modules.d.ts': 'declare module Test { interface B {} }',
  })

  const blocks = extractModuleBlocksFromTypes({
    tsOutDir: 'virtual',
    extractResult,
  })

  expect(blocks.length).toEqual(1)
  expect(blocks[0]).toContain('declare module Test')
})
