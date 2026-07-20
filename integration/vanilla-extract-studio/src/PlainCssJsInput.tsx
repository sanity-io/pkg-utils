/**
 * A lazily-loaded custom input that consumes `plain-css-js-dependency` — a node_modules
 * package that is not built with vanilla-extract but ships a plain JS `Styles.css.js` module
 * matching vanilla-extract's `cssFileFilter` (mirroring `@bynder/compact-view`, see
 * sanity-io/plugins#1553). `sanity.config.ts` wires it up through `React.lazy`, so under
 * `sanity dev` with `unstable_bundledDev` it becomes a chunk that is compiled on demand — the
 * scenario where processing the plain `.css.js` module used to hang the vanilla-extract
 * compiler and crash the dev server.
 */
import {getPlainCssJsStyles} from 'plain-css-js-dependency'
import {createElement, type ReactElement} from 'react'
import type {StringInputProps} from 'sanity'
import {veStudioLazyBadge} from './PlainCssJsInput.css'

export default function PlainCssJsInput(props: StringInputProps): ReactElement {
  return createElement(
    'div',
    {'className': veStudioLazyBadge, 'data-plain-css-js': getPlainCssJsStyles()},
    props.renderDefault(props),
  )
}
