import { vi } from 'vitest'

import { meta } from '../utils'

export const readFile = vi.fn(
  () => {
    if (meta) {
      return Promise.resolve(JSON.stringify(meta))
    } else {
      return Promise.reject(new Error('no meta'))
    }
  }
)

export const writeFile = vi.fn()
