const bool = true
const foo = <div />
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
      <button type={type} data-bool={bool}>
        {children}
      </button>
      {bar}
    </>
  )
}
