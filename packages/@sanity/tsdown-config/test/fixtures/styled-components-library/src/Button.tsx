import {styled} from 'styled-components'

const StyledButton = styled.button`
  cursor: pointer;
  border-radius: 2px;
  padding: 0;
`

// Not exported from the package entry: relies on `treeshake.manualPureFunctions`
// treating the `styled` factory as side effect free to be removed from the output
export const UnusedButton: React.ComponentType<React.ComponentProps<'button'>> = styled.button`
  appearance: none;
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
