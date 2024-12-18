import chokidar from 'chokidar'
import type {EventName} from 'chokidar/handler.js'
import {Observable} from 'rxjs'

export interface FileEvent {
  type: EventName
  file: string
}

export function watchFiles(patterns: string[]): Observable<FileEvent> {
  return new Observable((observer) => {
    const watcher = chokidar.watch(patterns, {
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
      watcher.close()
    }
  })
}
