import type {JSX, ReactNode} from 'react'

/** @public */
export interface Block {
  _key: string
  text: string
  style?: 'normal' | 'h1'
}

/** @public */
export interface PortableTextComponents {
  block: (props: {children: ReactNode; style: string}) => JSX.Element
  hardBreak: () => JSX.Element
}

const defaultComponents: PortableTextComponents = {
  block: ({children, style}) => (style === 'h1' ? <h1>{children}</h1> : <p>{children}</p>),
  hardBreak: () => <br />,
}

/**
 * A `@portabletext/react`-shaped renderer without any manual `useMemo`/`useCallback` calls:
 * the derived values below are exactly what a hand-written `useMemo` would have wrapped. The
 * compiled variant memoizes them with the React Compiler, while the `react-server` variant
 * runs the source as-is — React Server Components render exactly once, so memoization there
 * would be pure overhead.
 * @public
 */
export function PortableText(props: {
  value: Block[]
  components?: Partial<PortableTextComponents>
}): JSX.Element {
  const {value, components: overrides} = props
  const components = {...defaultComponents, ...overrides}
  const blocks = value.map((block) =>
    block.text === '' ? (
      <components.hardBreak key={block._key} />
    ) : (
      <components.block key={block._key} style={block.style ?? 'normal'}>
        {block.text.split('\n').join(' ')}
      </components.block>
    ),
  )
  return <>{blocks}</>
}
