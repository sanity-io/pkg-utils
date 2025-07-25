import {TextInput} from '@sanity/ui'
import type {StringInputProps} from 'sanity'
import {input} from './styles.css'

/** @public */
export interface ColorInputProps extends StringInputProps {}

export default function ColorInput(props: StringInputProps): React.JSX.Element {
  return <TextInput {...props.elementProps} type="color" className={input} />
}
