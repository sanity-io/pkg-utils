import styled from 'styled-components'

const Box = styled.div`
  display: block;
`

/** @public */
export function Card({children}: React.PropsWithChildren) {
  return <Box>{children}</Box>
}
