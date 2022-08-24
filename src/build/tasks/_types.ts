import {_DtsTask} from './dts'
import {_ExtractTask} from './extract'
import {_RollupTask} from './rollup'

/**
 * @internal
 */
export type _BuildTask = _DtsTask | _ExtractTask | _RollupTask
