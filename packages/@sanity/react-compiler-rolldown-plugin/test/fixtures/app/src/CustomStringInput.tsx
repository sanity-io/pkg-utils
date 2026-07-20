// Resolves to the shared fixture stub (Vite alias + tsconfig paths); the type import is erased
import type {StubInputProps} from 'sanity'

export function CustomStringInput(props: StubInputProps): React.JSX.Element {
  return (
    <div>
      {props.renderDefault(props)}
      <span data-testid="char-count">
        Characters: {typeof props.value === 'string' ? props.value.length : 0}
      </span>
    </div>
  )
}
