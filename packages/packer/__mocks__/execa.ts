import { hash, changed } from './utils'

export const execa = jest.fn(
  (command: string, args: string[]) => {
    if (command === 'git') {
      if (args[0] === 'rev-parse') {
        return Promise.resolve({ stdout: hash })
      } else if (args[0] === 'diff') {
        return Promise.resolve({ stdout: changed.map((c) => `${c.status}\t${c.path}`).join('\n') })
      }
    }
    return Promise.reject(new Error('not implemented'))
  }
)
