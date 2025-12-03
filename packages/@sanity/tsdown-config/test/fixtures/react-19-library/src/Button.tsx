import {useState} from 'react'

const bool = true
const Foo = () => {
  const [open, setOpen] = useState(false)
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
      {/* oxlint-disable-next-line no-constant-binary-expression */}
      {process.env.NODE_ENV === 'development' && <Foo />}
      <button type={type} data-bool={bool}>
        {children}
      </button>
      {bar}
    </>
  )
}
