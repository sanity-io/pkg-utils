import {forwardRef} from 'react'
import {styled} from 'styled-components'

const StyledButton = styled.button`
  cursor: pointer;
  border-radius: 2px;
  padding: 0;
`

export function Button({
  children,
  type = 'button',
}: {
  children: React.ReactNode
  type?: 'submit' | 'button' | 'reset'
}): React.JSX.Element {
  return <StyledButton type={type}>{children}</StyledButton>
}

// The `@sanity/ui` component pattern: a named function expression inside a pure-annotated
// `forwardRef(…)` call, where the inner name (shown by React DevTools via `Function.name`)
// is otherwise unreferenced and would be stripped by the minifier's compress pass
export const IconButton: React.ForwardRefExoticComponent<
  {children?: React.ReactNode} & React.RefAttributes<HTMLButtonElement>
> = forwardRef(function IconButton(
  {children}: {children?: React.ReactNode},
  ref: React.Ref<HTMLButtonElement>,
) {
  return <StyledButton ref={ref}>{children}</StyledButton>
})
