import {forwardRef, useEffect, useId, useImperativeHandle, useRef, useState} from 'react'

/** @public */
export const Input = forwardRef(function Input(
  props: {label?: React.ReactNode} & React.HTMLProps<HTMLInputElement>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
): React.JSX.Element {
  const {label, id: idProp, ...rest} = props

  const _id = useId()
  const id = idProp || _id
  const ref = useRef<HTMLInputElement>(null)

  useImperativeHandle<HTMLInputElement | null, HTMLInputElement | null>(
    forwardedRef,
    () => ref.current,
  )

  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const controller = new AbortController()
    const {signal} = controller

    ref.current.addEventListener('focus', () => setFocused(true), {signal})
    ref.current.addEventListener('blur', () => setFocused(false), {signal})

    return () => controller.abort()
  }, [])

  return (
    <>
      {label && (
        <label data-focused={focused ? '' : undefined} htmlFor={id}>
          {label}
        </label>
      )}
      <input {...rest} data-focused={focused ? '' : undefined} id={id} ref={ref} />
    </>
  )
})
