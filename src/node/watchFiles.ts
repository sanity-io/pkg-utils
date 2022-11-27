import chokidar from 'chokidar'
import {Observable} from 'rxjs'

export interface FileEvent {
  type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  file: string
}

export function watchFiles(patterns: string[]): Observable<FileEvent> {
  return new Observable((observer) => {
    const watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
    })

    function handleFileEvent(
      type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
      file: string
    ) {
      observer.next({type, file})
    }

    watcher.on('all', handleFileEvent)

    return () => {
      watcher.off('all', handleFileEvent)
      watcher.close()
    }
  })
}
