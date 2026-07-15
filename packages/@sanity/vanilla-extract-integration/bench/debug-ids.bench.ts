/**
 * The debug-IDs parser bench-off: `rolldown/parseAst` (oxc) vs `yuku-parser`, feeding the same
 * shared walker (`injectDebugIds`) over the same generated corpus, so the only variable is the
 * parse (native parse + AST transfer into JS).
 *
 * Run with `pnpm --filter @sanity/vanilla-extract-integration bench`. The corpus defaults to
 * 500 realistic `.css.ts` files (override with `VE_BENCH_DEBUG_IDS_FILES`) so per-file
 * microsecond deltas surface at the scale of a large real-world codebase; a full-corpus pass
 * is one benchmark iteration.
 *
 * Decision rule (see the PR that introduced this package): yuku-parser ships as the production
 * backend only if it saves whole seconds on a corpus pass; anything down at fractions of a
 * second means `rolldown/parseAst` wins on dependency weight, since rolldown is a dependency
 * of this package regardless (for `compile()`).
 *
 * Measured 2026-07-15 on Node 24.18.0, Linux x64, 4-core Intel Xeon (rolldown 1.2.0,
 * yuku-parser 0.6.1): yuku-parser is ~2x faster per pass — 57.6ms vs 117.3ms mean over the
 * default 500-file corpus (1.24 MiB), 270ms vs 576ms over a 2500-file corpus; cold import is
 * 9.0ms vs 6.6ms. A 2x parser win that saves ~60ms at realistic corpus scale is far below the
 * whole-seconds bar (and the transform only runs per-file in dev, never as a corpus pass), so
 * `rolldown/parseAst` ships and yuku-parser stays a devDependency of this bench.
 */
import {parseAst} from 'rolldown/parseAst'
import {bench, describe} from 'vitest'
import {parse as yukuParse} from 'yuku-parser'
import {injectDebugIds} from '../src/debugIds.ts'
import {generateCorpus} from './corpus.ts'

const corpus = generateCorpus()
const corpusBytes = corpus.reduce((total, source) => total + source.length, 0)

// eslint-disable-next-line no-console
console.log(
  `[debug-ids bench] corpus: ${corpus.length} files, ${(corpusBytes / 1024).toFixed(0)} KiB`,
)

describe(`inject debug IDs over ${corpus.length} .css.ts files`, () => {
  bench('rolldown/parseAst (oxc)', () => {
    for (const source of corpus) {
      injectDebugIds(source, parseAst(source, {lang: 'ts', preserveParens: false}))
    }
  })

  bench('yuku-parser', () => {
    for (const source of corpus) {
      injectDebugIds(source, yukuParse(source, {lang: 'ts', preserveParens: false}).program)
    }
  })
})
