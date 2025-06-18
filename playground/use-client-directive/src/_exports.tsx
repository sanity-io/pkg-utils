import {createContext, useContext, useMemo} from 'react'

const Context = createContext<'success' | 'failure'>('failure')

/** @public */
export const Provider = ({children}: {children: React.ReactNode}) => (
  <Context.Provider value="success">{children}</Context.Provider>
)
/** @public */
export const useResult = () => useContext(Context)

/** @public */
export const useMemoResult = () => {
  const result = useContext(Context)

  return useMemo(() => result, [result])
}
