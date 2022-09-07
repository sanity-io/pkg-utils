import {ScriptTarget} from 'typescript'
import {_BuildContext} from './_core'

const TS_TARGETS: Record<ScriptTarget, string> = {
  // ES3 = 0,
  0: 'es3',
  // ES5 = 1,
  1: 'es5',
  // ES2015 = 2,
  2: 'es2015',
  // ES2016 = 3,
  3: 'es2016',
  // ES2017 = 4,
  4: 'es2017',
  // ES2018 = 5,
  5: 'es2018',
  // ES2019 = 6,
  6: 'es2019',
  // ES2020 = 7,
  7: 'es2020',
  // ES2021 = 8,
  8: 'es2021',
  // ES2022 = 9,
  9: 'es2022',
  // ESNext = 99,
  99: 'esnext',
  // JSON = 100,
  100: 'esnext',
  // Latest = 99
}

/** @internal */
export function _resolveEsTarget(ctx: _BuildContext): string {
  const {ts} = ctx

  const tsTarget = ts.config?.options.target || 99

  return TS_TARGETS[tsTarget] || 'esnext'
}
