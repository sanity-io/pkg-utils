import {watch, type EmitArgsWithName} from 'chokidar'
import {Observable} from 'rxjs'

// Chokidar 6 publishes event names on this tuple from the package entry.
type EventName = EmitArgsWithName[0]

export interface FileEvent {
  type: EventName
  file: string
}

export function watchFiles(patterns: string[]): Observable<FileEvent> {
  return new Observable((observer) => {
    const watcher = watch(patterns, {
      ignoreInitial: true,
    })

    function handleFileEvent(type: EventName, file: string | Error) {
      if (type === 'error' || file instanceof Error) {
        observer.error(file)
      } else {
        observer.next({type, file})
      }
    }

    watcher.on('all', handleFileEvent)

    return () => {
      watcher.off('all', handleFileEvent)
      void watcher.close()
    }
  })
}
