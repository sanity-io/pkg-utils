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
