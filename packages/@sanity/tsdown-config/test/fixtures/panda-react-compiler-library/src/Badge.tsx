import {Box} from '#styled-system/jsx'

// A configured Panda JSX component: only the JSX carries its styles, there is no `css()` call
export function Badge({children}: {children: React.ReactNode}): React.JSX.Element {
  return <Box color="brand">{children}</Box>
}
