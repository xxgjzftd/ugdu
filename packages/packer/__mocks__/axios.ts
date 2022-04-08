import { meta } from './utils'

export default {
  get: jest.fn(
    () => {
      if (meta) {
        return Promise.resolve({ data: meta })
      } else {
        return Promise.reject(new Error('no meta'))
      }
    }
  )
}
