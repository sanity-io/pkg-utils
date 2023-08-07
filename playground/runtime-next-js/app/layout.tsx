import {Provider} from 'use-client-directive'

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <head />
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
