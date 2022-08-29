import path from "path"

export function p (name: string) {
  return path.resolve(__dirname, name)
}
