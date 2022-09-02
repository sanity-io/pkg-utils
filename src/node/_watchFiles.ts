import chokidar from 'chokidar'
import {Observable} from 'rxjs'

export interface _FileEvent {
  type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
  file: string
}

export function _watchFiles(patterns: string[]): Observable<_FileEvent> {
  return new Observable((observer) => {
    const watcher = chokidar.watch(patterns, {
      ignoreInitial: true,
    })

    function _handleFileEvent(
      type: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir',
      file: string
    ) {
      observer.next({type, file})
    }

    watcher.on('all', _handleFileEvent)

    return () => {
      watcher.off('all', _handleFileEvent)
      watcher.close()
    }
  })
}
