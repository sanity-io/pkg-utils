export function Button({children, ...props}: {children: React.ReactNode; type: 'submit' | 'button' | 'reset'}) {
  let {type} = props
  type??= 'button'
  return <button type={type}>{children}</button>
}
