export class ExecError extends Error {
  stdout: string
  stderr: string

  constructor(message: string, stdout: string, stderr: string) {
    super(message)
    this.stdout = stdout
    this.stderr = stderr
  }
}
