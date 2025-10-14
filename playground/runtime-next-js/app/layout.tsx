import {Provider} from 'use-client-directive'

export default function RootLayout({children}: {children: React.ReactNode}): React.JSX.Element {
  return (
    <html lang="en">
      <head />
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
