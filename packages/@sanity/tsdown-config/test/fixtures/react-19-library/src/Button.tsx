import {useEffect} from 'react'

const bool = true
const Foo = () => {
  useEffect(() => {
    console.log('Foo')
  })
  return <div />
}
const bar = <div />

export function Button({
  children,
  type = 'button',
}: {
  children: React.ReactNode
  type?: 'submit' | 'button' | 'reset'
}): React.JSX.Element {
  return (
    <>
      {/* @ts-expect-error - This is a test */}
      {process.env.NODE_ENV === 'development' && <Foo />}
      <button type={type} data-bool={bool}>
        {children}
      </button>
      {bar}
    </>
  )
}
