import {createRootRoute, HeadContent, Outlet, Scripts} from '@tanstack/react-router'
import type {ReactNode} from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [{charSet: 'utf-8'}, {title: '@css-playground/tanstack-start'}],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({children}: Readonly<{children: ReactNode}>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
