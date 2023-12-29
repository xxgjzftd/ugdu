import { vi } from 'vitest'
import { meta } from './utils'

export default {
  get: vi.fn(
    () => {
      if (meta) {
        return Promise.resolve({ data: meta })
      } else {
        return Promise.reject(new Error('no meta'))
      }
    }
  )
}
